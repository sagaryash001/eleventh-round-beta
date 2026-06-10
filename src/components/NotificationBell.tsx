import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getNotifications, markAllNotificationsRead, type Notification } from '../lib/api/notifications'

export default function NotificationBell() {
  const [open,          setOpen]          = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const ref                               = useRef<HTMLDivElement>(null)
  const { user }                          = useAuth()
  const navigate                          = useNavigate()

  useEffect(() => {
    if (!user) { setNotifications([]); setUnreadCount(0); return }
    const load = () =>
      getNotifications({ limit: 10 })
        .then(r => { setNotifications(r.notifications); setUnreadCount(r.unread_count) })
        .catch(() => {})
    load()

    const sb = supabase
    if (!sb) return
    const channel = sb
      .channel(`notif-bell:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, () => load())
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead().catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
    setUnreadCount(0)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-9 h-9"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        aria-label="Notifications"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7a7672" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 text-[9px] font-bold leading-none rounded-full flex items-center justify-center"
            style={{ background: '#8b0000', color: '#f0ece4', minWidth: 16, height: 16, padding: '0 3px' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded shadow-2xl overflow-hidden"
          style={{ width: 320, background: '#0d0d0f', border: '1px solid rgba(255,255,255,0.07)', zIndex: 2000, top: '100%' }}
        >
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-xs font-bold uppercase tracking-widest"
              style={{ color: '#f0ece4', letterSpacing: '0.18em' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead}
                className="text-[10px] uppercase tracking-widest"
                style={{ color: '#7a7672', background: 'none', border: 'none', cursor: 'pointer' }}>
                Mark all read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm" style={{ color: '#4a4846' }}>No notifications</p>
            ) : (
              notifications.map(n => (
                <button key={n.id}
                  className="w-full text-left px-4 py-3 transition-colors"
                  style={{
                    background: n.read_at ? 'transparent' : 'rgba(139,0,0,0.06)',
                    cursor: 'pointer', border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                  onClick={() => {
                    setOpen(false)
                    if (n.action_url) navigate(n.action_url.replace(window.location.origin, ''))
                  }}
                >
                  <p className="text-xs font-semibold mb-0.5"
                    style={{ color: n.read_at ? '#7a7672' : '#f0ece4' }}>{n.title}</p>
                  {n.body && (
                    <p className="text-[11px] truncate" style={{ color: '#4a4846' }}>{n.body}</p>
                  )}
                </button>
              ))
            )}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Link to="/inbox"
              className="block text-center text-[10px] uppercase tracking-widest py-3"
              style={{ color: '#7a7672', textDecoration: 'none' }}>
              Open Inbox
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
