// Typed wrappers for the Event Calendar API (server/routes/events.js)
import { apiGet, apiPost, apiPatch, apiDelete } from './client'

export type EventType =
  | 'fight' | 'promotion_event' | 'media_event' | 'weigh_in'
  | 'camp' | 'sponsor_activation' | 'other'
export type EventStatus = 'planned' | 'active' | 'completed' | 'cancelled'
export type EventVisibility = 'private' | 'manager_visible' | 'promoter_visible' | 'public'
export type ObStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'skipped'
export type ObVisibility = 'private' | 'manager_visible' | 'promoter_visible' | 'sponsor_visible'

export interface EventParticipant { user_id: string; role: string; name: string; status?: 'pending' | 'confirmed' | 'declined' }

export interface CalEvent {
  id: string
  name: string
  event_type: EventType
  event_date: string
  timezone: string | null
  location: string | null
  opponent: string | null
  promotion_name: string | null
  weight_class: string | null
  status: EventStatus
  notes: string | null
  visibility: EventVisibility
  external_url: string | null
  owner_id: string | null
  manager_id: string | null
  promoter_id: string | null
  created_by: string
  source?: 'manual' | 'calendly'
  calendly_scheduling_url?: string | null
  calendly_event_type_uri?: string | null
  calendly_synced_event_id?: string | null
  calendly_meeting_status?: string | null
  my_participant_status?: 'pending' | 'confirmed' | 'declined' | null
  participants?: EventParticipant[]
  obligation_total?: number
  obligation_done?: number
  obligation_overdue?: number
  can_edit?: boolean
  relation?: string
}

export interface EventObligation {
  id: string
  event_id: string
  title: string
  description: string | null
  category: string | null
  assigned_to_user_id: string | null
  assigned_to_name?: string | null
  due_date: string | null
  status: ObStatus
  visibility: ObVisibility
  proof_required: boolean
  proof_url: string | null
  template_key: string | null
}

export interface ObTemplate {
  key: string
  title: string
  category: string
  offset_days: number
  proof_required: boolean
  visibility: ObVisibility
}

export interface NewEvent {
  name: string
  event_type: EventType
  event_date: string
  location?: string | null
  opponent?: string | null
  promotion_name?: string | null
  weight_class?: string | null
  status?: EventStatus
  visibility?: EventVisibility
  external_url?: string | null
  notes?: string | null
  fighter_ids?: string[]
  calendly_scheduling_url?: string | null
  calendly_event_type_uri?: string | null
}

// ── Unified calendar feed (server/routes/events.js → /calendar-feed) ──────────
export type FeedItemType = 'event' | 'calendly' | 'obligation' | 'deadline'
export type FeedSource   = 'manual' | 'calendly' | 'contract' | 'sponsorforge'

export interface CalendarFeedItem {
  id: string
  type: FeedItemType
  source: FeedSource
  title: string
  start: string | null
  end: string | null
  date: string
  status: string
  badge: string
  event_id: string | null
  obligation_id: string | null
  contract_id: string | null
  visibility: string
  can_edit: boolean
  metadata: Record<string, any>
}

export interface CalendarFeed {
  items: CalendarFeedItem[]
  range: { from: string; to: string }
}

export const getCalendarFeed = (params?: {
  from?: string; to?: string; include_past?: boolean; type?: string
}) => {
  const q = new URLSearchParams()
  if (params?.from) q.set('from', params.from)
  if (params?.to) q.set('to', params.to)
  if (params?.include_past) q.set('include_past', '1')
  if (params?.type && params.type !== 'all') q.set('type', params.type)
  const qs = q.toString()
  return apiGet<CalendarFeed>(`/api/events/calendar-feed${qs ? `?${qs}` : ''}`)
}

export const getEvents = () =>
  apiGet<{ events: CalEvent[] }>('/api/events')

export const getEventTemplates = () =>
  apiGet<{ templates: ObTemplate[] }>('/api/events/templates')

export const createEvent = (data: NewEvent) =>
  apiPost<{ ok: boolean; event: CalEvent }>('/api/events', data)

export const getEvent = (id: string) =>
  apiGet<{ event: CalEvent; participants: EventParticipant[]; obligations: EventObligation[] }>(`/api/events/${id}`)

export const updateEvent = (id: string, data: Partial<NewEvent>) =>
  apiPatch<{ ok: boolean }>(`/api/events/${id}`, data)

export const deleteEvent = (id: string) =>
  apiDelete<{ ok: boolean }>(`/api/events/${id}`)

export const addObligation = (eventId: string, data: {
  title: string; description?: string; category?: string
  assigned_to_user_id?: string | null; due_date?: string | null
  visibility?: ObVisibility; proof_required?: boolean
}) => apiPost<{ ok: boolean; obligation: EventObligation }>(`/api/events/${eventId}/obligations`, data)

export const addObligationsFromTemplate = (eventId: string, templates: string[], assigned_to?: string | null) =>
  apiPost<{ ok: boolean; added: number }>(`/api/events/${eventId}/obligations/from-template`, { templates, assigned_to })

export const updateObligation = (oid: string, data: Partial<EventObligation>) =>
  apiPatch<{ ok: boolean }>(`/api/events/obligations/${oid}`, data)

export const completeObligation = (oid: string, proof_url?: string) =>
  apiPost<{ ok: boolean }>(`/api/events/obligations/${oid}/complete`, proof_url ? { proof_url } : {})

// ── Guided event setup (wizard) + confirmation ────────────────────────────────
export interface GuidedCreatePayload {
  event_type: EventType
  details: {
    name: string; event_date: string; timezone?: string | null; location?: string | null
    external_url?: string | null; notes?: string | null
    opponent?: string | null; promotion_name?: string | null; weight_class?: string | null
    visibility?: EventVisibility
  }
  answers?: Record<string, any>
  participants?: { fighter_ids?: string[]; manager_id?: string | null; promoter_id?: string | null; sponsor_id?: string | null }
  selected_templates?: string[]
  due_date_overrides?: Record<string, string>
  visibility_overrides?: Record<string, ObVisibility>
  calendly_event_type_uri?: string | null
  calendly_scheduling_url?: string | null
}

export const guidedCreateEvent = (data: GuidedCreatePayload) =>
  apiPost<{ ok: boolean; event: CalEvent; obligations: EventObligation[] }>('/api/events/guided-create', data)

export const confirmEvent = (id: string) =>
  apiPost<{ ok: boolean; status: string }>(`/api/events/${id}/confirm`)

export const declineEvent = (id: string) =>
  apiPost<{ ok: boolean; status: string }>(`/api/events/${id}/decline`)
