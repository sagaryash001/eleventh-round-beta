import { apiGet, apiPost } from './client'

export interface Notification {
  id: string
  recipient_id: string
  type: string
  title: string
  body: string | null
  action_url: string | null
  read_at: string | null
  sent_email: boolean
  related_type: string | null
  related_id: string | null
  created_at: string
}

export const getNotifications = (opts: { unread?: boolean; limit?: number } = {}) => {
  const params = new URLSearchParams()
  if (opts.unread)  params.set('unread', 'true')
  if (opts.limit)   params.set('limit', String(opts.limit))
  const qs = params.toString()
  return apiGet<{ ok: boolean; notifications: Notification[]; unread_count: number }>(
    `/api/notifications${qs ? '?' + qs : ''}`,
  )
}

export const markNotificationRead = (id: string) =>
  apiPost<{ ok: boolean }>(`/api/notifications/${id}/read`)

export const markAllNotificationsRead = () =>
  apiPost<{ ok: boolean }>('/api/notifications/read-all')
