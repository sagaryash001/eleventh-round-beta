import { apiGet, apiPost } from './client'

export interface ConversationParticipant {
  conversation_id: string
  user_id: string
  role_in_thread: 'member' | 'owner' | 'observer'
  unread_count: number
  last_read_at: string | null
  muted: boolean
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  body: string | null
  message_type: 'text' | 'system' | 'attachment' | 'application_update' | 'contract_update'
  attachments: { path: string; name: string; size: number; mime: string }[]
  edited_at: string | null
  deleted_at: string | null
  created_at: string
}

export interface Conversation {
  id: string
  subject: string | null
  context_type: 'direct' | 'application' | 'contract' | 'support'
  context_id: string | null
  created_by: string | null
  last_message_at: string | null
  created_at: string
  my_unread_count: number
  my_last_read_at: string | null
  muted: boolean
  last_message: Message | null
}

export const getConversations = () =>
  apiGet<{ ok: boolean; conversations: Conversation[]; profiles: Record<string, { id: string; name: string; role: string }> }>('/api/conversations')

export const createConversation = (
  participant_ids: string[],
  opts: { context_type?: string; context_id?: string; subject?: string; initial_message?: string } = {},
) =>
  apiPost<{ ok: boolean; conversation: Conversation; first_message: Message | null; existed?: boolean }>(
    '/api/conversations', { participant_ids, ...opts },
  )

export const getMessages = (conversationId: string, opts: { limit?: number; before?: string } = {}) => {
  const params = new URLSearchParams()
  if (opts.limit)  params.set('limit', String(opts.limit))
  if (opts.before) params.set('before', opts.before)
  const qs = params.toString()
  return apiGet<{ ok: boolean; messages: Message[]; has_more: boolean }>(
    `/api/conversations/${conversationId}/messages${qs ? '?' + qs : ''}`,
  )
}

export const sendMessage = (conversationId: string, body: string, attachments?: any[]) =>
  apiPost<{ ok: boolean; message: Message }>(
    `/api/conversations/${conversationId}/messages`, { body, attachments },
  )

export const markConversationRead = (conversationId: string) =>
  apiPost<{ ok: boolean }>(`/api/conversations/${conversationId}/read`)
