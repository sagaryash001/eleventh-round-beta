// Calendly integration — frontend only ever sees connection STATUS, never tokens.
import { apiGet, apiPost } from './client'

export interface CalendlyStatus {
  connected: boolean
  configured: boolean
  scheduling_url?: string | null
  synced_count?: number
  last_synced_at?: string | null
  /** true when a webhook subscription exists → Calendly pushes bookings live. */
  auto_sync?: boolean
  manual_sync_enabled?: boolean
  auto_sync_active?: boolean
  can_create_scheduling_links?: boolean
  can_cancel_events?: boolean
  scopes?: string[]
}

export interface CalendlyEventType {
  uri: string
  name: string
  scheduling_url: string
  duration: number
  active: boolean
}

export const getCalendlyStatus = () =>
  apiGet<CalendlyStatus>('/api/calendly/status')

export const getCalendlyConnectUrl = () =>
  apiGet<{ url: string }>('/api/calendly/connect-url')

export const getCalendlyEventTypes = () =>
  apiGet<{ event_types: CalendlyEventType[] }>('/api/calendly/event-types')

export const syncCalendly = () =>
  apiPost<{ ok: boolean; imported: number; updated: number; canceled: number }>('/api/calendly/sync')

export const disconnectCalendly = () =>
  apiPost<{ ok: boolean }>('/api/calendly/disconnect')

// Create a booking link for an app event from one of the user's Calendly event types.
export const createSchedulingLink = (data: {
  event_id: string
  calendly_event_type_uri: string
  single_use?: boolean
  max_event_count?: number
}) => apiPost<{ ok: boolean; booking_url: string }>('/api/calendly/scheduling-links', data)

// Cancel a synced Calendly meeting (uses the stored event URI server-side).
export const cancelCalendlyMeeting = (syncedEventId: string, reason?: string) =>
  apiPost<{ ok: boolean; already?: boolean }>(`/api/calendly/events/${syncedEventId}/cancel`, reason ? { reason } : {})
