import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import {
  getConversations, getMessages, sendMessage, markConversationRead,
  type Conversation, type Message,
} from '../lib/api/conversations'
import Navbar from '../components/Navbar'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTimestamp(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConversationItem({
  conv,
  profiles,
  myId,
  active,
  onClick,
}: {
  conv: Conversation
  profiles: Record<string, { id: string; name: string; role: string }>
  myId: string
  active: boolean
  onClick: () => void
}) {
  // Find the other participant's name using the profiles map
  const otherName = Object.values(profiles).find(p => p.id !== myId)?.name ?? 'Unknown'

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-5 py-4 border-b transition-colors duration-150"
      style={{
        background:  active ? 'rgba(139,0,0,0.12)' : 'transparent',
        borderColor: active ? 'rgba(139,0,0,0.3)' : 'rgba(255,255,255,0.04)',
        borderLeft:  active ? '2px solid #8b0000' : '2px solid transparent',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className="font-bold text-sm truncate pr-2"
          style={{ color: active ? '#f0ece4' : '#b8b4ae' }}
        >
          {conv.subject || otherName}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {conv.my_unread_count > 0 && (
            <span
              className="text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none"
              style={{ background: '#8b0000', color: '#f0ece4' }}
            >
              {conv.my_unread_count}
            </span>
          )}
          {conv.last_message_at && (
            <span className="text-[11px]" style={{ color: '#4a4846' }}>
              {timeAgo(conv.last_message_at)}
            </span>
          )}
        </div>
      </div>
      {conv.last_message && (
        <p
          className="text-[12px] truncate"
          style={{ color: conv.my_unread_count > 0 ? '#7a7672' : '#4a4846' }}
        >
          {conv.last_message.body ?? 'Attachment'}
        </p>
      )}
    </button>
  )
}

function MessageBubble({ msg, isMe }: { msg: Message; isMe: boolean }) {
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className="max-w-[72%] px-4 py-3 rounded"
        style={{
          background: isMe ? '#8b0000' : 'rgba(255,255,255,0.05)',
          borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        }}
      >
        {msg.body && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#f0ece4' }}>
            {msg.body}
          </p>
        )}
        <p
          className="text-[10px] mt-1 text-right"
          style={{ color: isMe ? 'rgba(240,236,228,0.5)' : '#4a4846' }}
        >
          {formatTimestamp(msg.created_at)}
        </p>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [profiles, setProfiles] = useState<Record<string, { id: string; name: string; role: string }>>({})
  const [activeId, setActiveId]   = useState<string | null>(null)
  const [messages, setMessages]   = useState<Message[]>([])
  const [draft, setDraft]         = useState('')
  const [sending, setSending]     = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs]   = useState(false)
  const [hasMore, setHasMore]     = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)

  // Redirect if not logged in
  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  // ── Load conversations ──────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!user) return
    try {
      setLoadingConvs(true)
      const res = await getConversations()
      setConversations(res.conversations)
      setProfiles(res.profiles ?? {})
    } catch (e) {
      console.error('Failed to load conversations', e)
    } finally {
      setLoadingConvs(false)
    }
  }, [user])

  useEffect(() => { loadConversations() }, [loadConversations])

  // ── Load messages when conversation changes ────────────────────────────────
  useEffect(() => {
    if (!activeId) return
    let cancelled = false

    const load = async () => {
      setLoadingMsgs(true)
      setMessages([])
      try {
        const res = await getMessages(activeId, { limit: 40 })
        if (!cancelled) {
          setMessages(res.messages)
          setHasMore(res.has_more)
        }
      } catch (e) {
        console.error('Failed to load messages', e)
      } finally {
        if (!cancelled) setLoadingMsgs(false)
      }

      // Mark as read
      markConversationRead(activeId).catch(() => {})
      setConversations(prev =>
        prev.map(c => c.id === activeId ? { ...c, my_unread_count: 0 } : c)
      )
    }

    load()
    return () => { cancelled = true }
  }, [activeId])

  // ── Scroll to bottom on new messages ──────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Supabase Realtime subscription ────────────────────────────────────────
  useEffect(() => {
    const sb = supabase
    if (!activeId || !sb) return

    const channel = sb
      .channel(`chat:${activeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages(prev => {
            // Avoid duplicates (our own sends are already added optimistically)
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          // Update conversation list last_message
          setConversations(prev =>
            prev.map(c =>
              c.id === activeId
                ? { ...c, last_message: newMsg, last_message_at: newMsg.created_at }
                : c
            )
          )
        },
      )
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [activeId])

  // ── Load more (older) messages ─────────────────────────────────────────────
  const loadMore = async () => {
    if (!activeId || !hasMore || !messages.length) return
    const before = messages[0].created_at
    try {
      const res = await getMessages(activeId, { limit: 40, before })
      setMessages(prev => [...res.messages, ...prev])
      setHasMore(res.has_more)
    } catch (e) {
      console.error('Failed to load more', e)
    }
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!activeId || !draft.trim() || sending) return
    const body = draft.trim()
    setSending(true)
    setDraft('')

    // Optimistic update
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: activeId,
      sender_id: user!.id,
      body,
      message_type: 'text',
      attachments: [],
      edited_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    try {
      const res = await sendMessage(activeId, body)
      // Replace optimistic with real message
      setMessages(prev => prev.map(m => m.id === optimistic.id ? res.message : m))
      setConversations(prev =>
        prev.map(c =>
          c.id === activeId
            ? { ...c, last_message: res.message, last_message_at: res.message.created_at }
            : c
        )
      )
    } catch (e) {
      console.error('Failed to send message', e)
      // Revert optimistic
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setDraft(body)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const activeConv = conversations.find(c => c.id === activeId) ?? null

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>
      <Navbar />

      <div
        className="flex"
        style={{ height: '100vh', paddingTop: 80 }}
      >
        {/* ── Left: conversation list ── */}
        <div
          className="flex-shrink-0 flex flex-col"
          style={{
            width: 320,
            borderRight: '1px solid rgba(255,255,255,0.06)',
            background: '#0a0a0c',
          }}
        >
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h1
              className="font-display text-lg uppercase tracking-widest"
              style={{ color: '#f0ece4', letterSpacing: '0.18em' }}
            >
              Inbox
            </h1>
            <Link
              to={`/dashboard/${user.role}`}
              className="text-[10px] uppercase tracking-widest"
              style={{ color: '#4a4846', textDecoration: 'none' }}
            >
              ← Dashboard
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex items-center justify-center h-24">
                <div className="text-sm" style={{ color: '#4a4846' }}>Loading…</div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm" style={{ color: '#4a4846' }}>No conversations yet.</p>
                <p className="text-xs mt-2" style={{ color: '#3a3836' }}>
                  Start one from an application or opportunity page.
                </p>
              </div>
            ) : (
              conversations.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  profiles={profiles}
                  myId={user.id}
                  active={conv.id === activeId}
                  onClick={() => setActiveId(conv.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right: message thread ── */}
        <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
          {!activeId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div
                  className="text-4xl mb-4 font-display uppercase tracking-widest"
                  style={{ color: 'rgba(139,0,0,0.3)', fontSize: 48 }}
                >
                  ER
                </div>
                <p className="text-sm" style={{ color: '#4a4846' }}>
                  Select a conversation to start messaging.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div
                className="flex-shrink-0 px-6 py-4 flex items-center gap-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0a0a0c' }}
              >
                <div>
                  <p className="font-bold text-sm" style={{ color: '#f0ece4' }}>
                    {activeConv?.subject || 'Direct message'}
                  </p>
                  {activeConv?.context_type !== 'direct' && (
                    <p className="text-[11px]" style={{ color: '#4a4846' }}>
                      {activeConv?.context_type}
                    </p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto px-6 py-4"
                style={{ background: '#080808' }}
              >
                {hasMore && (
                  <div className="text-center mb-4">
                    <button
                      onClick={loadMore}
                      className="text-[11px] uppercase tracking-widest px-3 py-1.5 transition-colors"
                      style={{
                        color: '#7a7672',
                        border: '1px solid rgba(255,255,255,0.06)',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      Load older messages
                    </button>
                  </div>
                )}

                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-sm" style={{ color: '#4a4846' }}>Loading messages…</div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm" style={{ color: '#4a4846' }}>No messages yet. Say something.</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <MessageBubble key={msg.id} msg={msg} isMe={msg.sender_id === user.id} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose */}
              <div
                className="flex-shrink-0 px-4 py-3 flex gap-3 items-end"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0a0a0c' }}
              >
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
                  rows={1}
                  className="flex-1 resize-none text-sm rounded px-4 py-3 outline-none transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#f0ece4',
                    maxHeight: 160,
                    minHeight: 44,
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,0,0,0.4)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className="flex-shrink-0 px-5 py-3 font-bold text-xs uppercase tracking-widest transition-all duration-200"
                  style={{
                    background: draft.trim() && !sending ? '#8b0000' : 'rgba(139,0,0,0.2)',
                    color: draft.trim() && !sending ? '#f0ece4' : '#4a4846',
                    border: 'none',
                    cursor: draft.trim() && !sending ? 'pointer' : 'not-allowed',
                    letterSpacing: '0.18em',
                  }}
                >
                  {sending ? '…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
