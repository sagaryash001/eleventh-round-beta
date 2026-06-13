// Calendly integration — frontend only ever sees connection STATUS, never tokens.
import { apiGet, apiPost } from './client'

export interface CalendlyStatus {
  connected: boolean
  configured: boolean
  scheduling_url?: string | null
  synced_count?: number
  last_synced_at?: string | null
}

export const getCalendlyStatus = () =>
  apiGet<CalendlyStatus>('/api/calendly/status')

export const getCalendlyConnectUrl = () =>
  apiGet<{ url: string }>('/api/calendly/connect-url')

export const syncCalendly = () =>
  apiPost<{ ok: boolean; imported: number; updated: number; canceled: number }>('/api/calendly/sync')

export const disconnectCalendly = () =>
  apiPost<{ ok: boolean }>('/api/calendly/disconnect')
