import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { clearApiCache } from './useApi'

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
  login:        (email: string, password: string) => Promise<{ ok: boolean; error?: string; needsVerification?: boolean }>
  register:     (data: RegisterData) => Promise<{ ok: boolean; error?: string; autoConfirmed?: boolean; code?: string }>
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

  // Tracks the session we currently consider "active". Bumped on every auth
  // event AND on logout, so a deferred profile fetch can detect that the
  // session it was started for is no longer current and bail — this prevents
  // a late fetch from re-signing-in a user who just logged out.
  const sessionGen = useRef(0)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    let cancelled = false

    // Watchdog: never let a hung getSession() strand the app on the blank
    // PageFallback. After 8s, resolve loading regardless (guards then send
    // an unauthenticated user to /login rather than spinning forever).
    const watchdog = setTimeout(() => { if (!cancelled) setLoading(false) }, 8000)

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      const gen = ++sessionGen.current
      if (data.session?.user) {
        const profile = await fetchProfile(data.session.user.id)
        if (profile && !cancelled && gen === sessionGen.current) {
          setUser(profile)
          setToken(data.session.access_token)
        }
      }
      if (!cancelled) setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Any auth transition invalidates in-flight deferred fetches.
      const gen = ++sessionGen.current
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null)
        setToken(null)
        setLoading(false)
        return
      }
      // Defer the Supabase call (sync calls inside this callback can deadlock),
      // then only apply if this is still the current session.
      setTimeout(async () => {
        if (cancelled || gen !== sessionGen.current) return
        const profile = await fetchProfile(session.user.id)
        if (profile && !cancelled && gen === sessionGen.current) {
          setUser(profile)
          setToken(session.access_token)
        }
      }, 0)
    })

    return () => {
      cancelled = true
      clearTimeout(watchdog)
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
      // Supabase returns "Email not confirmed" for unverified accounts. Flag it
      // so the login screen can auto-resend a verification link and show help.
      if (/not confirmed|email.*confirm|confirm.*email/i.test(error.message)) {
        return { ok: false, error: 'Your email is not verified yet.', needsVerification: true }
      }
      console.error('[auth] login failed:', error.message)
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
      if (!res.ok) {
        console.error('[auth] register failed:', res.status, json?.error)
        return { ok: false, error: json.error ?? 'Registration failed.', code: json?.code }
      }
      return { ok: true, autoConfirmed: !!json.autoConfirmed }
    } catch (err) {
      console.error('[auth] register request error:', (err as Error)?.message)
      return { ok: false, error: 'Cannot reach the server. Is it running?' }
    }
  }, [])

  const logout = useCallback(async () => {
    // Invalidate any deferred profile fetch so it can't re-sign-us-in.
    sessionGen.current++
    setUser(null)
    setToken(null)
    setLoading(false)
    // Drop user-specific cached API data (keeps public localStorage caches).
    clearApiCache()
    // signOut exactly once; never let a network hang block the redirect —
    // user is already null so route guards have already sent us to /login.
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
