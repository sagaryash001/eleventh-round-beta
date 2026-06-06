import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'

export type UserRole = 'fighter' | 'manager' | 'admin' | 'sponsor'

export interface AuthUser {
  id:                  string
  name:                string
  role:                UserRole
  email:               string
  subdomain?:          string | null
  avatar?:             string
  onboarding_complete: boolean
}

export interface RegisterData {
  name:        string
  email:       string
  password:    string
  accountType: 'fighter' | 'management' | 'promotion' | 'sponsor'
  teamName?:   string
  subdomain?:  string
  onboarding?: { q1: string; q2: string; q3: string; q4: string; q5: string }
}

interface AuthContextValue {
  user:         AuthUser | null
  token:        string | null
  loading:      boolean
  login:        (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  register:     (data: RegisterData) => Promise<{ ok: boolean; error?: string; autoConfirmed?: boolean }>
  logout:       () => Promise<void>
  refreshUser:  () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(userId: string): Promise<AuthUser | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, subdomain, onboarding_complete')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    id:                  data.id,
    email:               data.email,
    name:                data.name,
    role:                data.role as UserRole,
    subdomain:           data.subdomain,
    onboarding_complete: !!data.onboarding_complete,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null)
  const [token,   setToken]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    let cancelled = false

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      if (data.session?.user) {
        const profile = await fetchProfile(data.session.user.id)
        if (profile && !cancelled) {
          setUser(profile)
          setToken(data.session.access_token)
        }
      }
      if (!cancelled) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null)
        setToken(null)
        return
      }
      setTimeout(async () => {
        const profile = await fetchProfile(session.user.id)
        if (profile) {
          setUser(profile)
          setToken(session.access_token)
        }
      }, 0)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const refreshUser = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    if (!data.session?.user) return
    const profile = await fetchProfile(data.session.user.id)
    if (profile) {
      setUser(profile)
      setToken(data.session.access_token)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    if (!supabase) return { ok: false, error: 'Auth is not configured.' }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (/not confirmed/i.test(error.message)) {
        return { ok: false, error: 'Email not verified — check your inbox.' }
      }
      return { ok: false, error: error.message || 'Login failed.' }
    }

    const profile = await fetchProfile(data.user.id)
    if (!profile) return { ok: false, error: 'Logged in, but profile not found. Contact support.' }
    setUser(profile)
    setToken(data.session.access_token)
    return { ok: true }
  }, [])

  const register = useCallback(async (data: RegisterData) => {
    try {
      const res  = await apiFetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) return { ok: false, error: json.error ?? 'Registration failed.' }
      return { ok: true, autoConfirmed: !!json.autoConfirmed }
    } catch {
      return { ok: false, error: 'Cannot reach the server. Is it running?' }
    }
  }, [])

  const logout = useCallback(async () => {
    setUser(null)
    setToken(null)
    if (supabase) await supabase.auth.signOut().catch(() => {})
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
