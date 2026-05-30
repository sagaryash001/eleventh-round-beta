// ─────────────────────────────────────────────────────────────────────────────
// useAuth — Supabase-backed auth context
//
// External API is unchanged from the previous JWT version, so RegisterPage,
// LoginPage, Navbar, ProtectedRoute, DashShell, and VerifyEmailPage all
// continue to work without modification.
//
// Demo credentials still work for local development (skip Supabase entirely
// when the email matches one of the DEMO accounts). This is intentional —
// it lets you tour the dashboards without setting up Supabase first.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'

export type UserRole = 'fighter' | 'manager' | 'admin' | 'sponsor'

export interface AuthUser {
  id: string
  name: string
  role: UserRole
  email: string
  subdomain?: string | null
  avatar?: string
}

export interface RegisterData {
  name: string
  email: string
  password: string
  accountType: 'fighter' | 'management' | 'promotion'
  teamName?: string
  subdomain?: string
  onboarding?: {
    q1: string
    q2: string
    q3: string
    q4: string
    q5: string
  }
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login:    (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  register: (data: RegisterData) => Promise<{ ok: boolean; error?: string; autoConfirmed?: boolean }>
  logout:   () => Promise<void>
}

// ── Demo credentials kept for development convenience ────────────────────────
const DEMO: Record<string, AuthUser & { password: string }> = {
  'fighter@demo.com': { id: 'f1', name: 'Marcus Torres', role: 'fighter', email: 'fighter@demo.com', password: 'fighter123' },
  'manager@demo.com': { id: 'm1', name: 'Ray Callahan',  role: 'manager', email: 'manager@demo.com', password: 'manager123' },
  'admin@demo.com':   { id: 'a1', name: 'Jordan Hayes',  role: 'admin',   email: 'admin@demo.com',   password: 'admin123'   },
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── localStorage helpers (for demo accounts only) ────────────────────────────
function loadLocal(): { user: AuthUser | null; token: string | null } {
  try {
    const token = localStorage.getItem('er_token')
    const raw   = localStorage.getItem('er_user')
    return { token, user: raw ? JSON.parse(raw) : null }
  } catch { return { token: null, user: null } }
}

function persistLocal(u: AuthUser | null, t: string | null) {
  if (u && t) {
    localStorage.setItem('er_user',  JSON.stringify(u))
    localStorage.setItem('er_token', t)
  } else {
    localStorage.removeItem('er_user')
    localStorage.removeItem('er_token')
  }
}

// ── Map a Supabase user + profile row into our AuthUser shape ────────────────
async function fetchProfile(userId: string): Promise<AuthUser | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, subdomain')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    id:        data.id,
    email:     data.email,
    name:      data.name,
    role:      data.role as UserRole,
    subdomain: data.subdomain,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const init = loadLocal()
  const [user,    setUser]    = useState<AuthUser | null>(init.user)
  const [token,   setToken]   = useState<string | null>(init.token)
  const [loading, setLoading] = useState(true)

  // Subscribe to Supabase auth state on mount
  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let cancelled = false

    // 1. Hydrate from current Supabase session
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      if (data.session?.user) {
        const profile = await fetchProfile(data.session.user.id)
        if (profile) {
          setUser(profile)
          setToken(data.session.access_token)
        }
      }
      setLoading(false)
    })

    // 2. Listen for future changes (sign-in, sign-out, refresh)
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        // Don't clobber a demo session — those don't have a real Supabase session.
        const local = loadLocal()
        if (local.token !== 'demo-token') {
          setUser(null); setToken(null)
        }
        return
      }
      const profile = await fetchProfile(session.user.id)
      if (profile) {
        setUser(profile)
        setToken(session.access_token)
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  // ── login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    // Demo shortcut — works without Supabase
    const demo = DEMO[email.toLowerCase()]
    if (demo && demo.password === password) {
      await new Promise(r => setTimeout(r, 700))
      const { password: _pw, ...u } = demo
      persistLocal(u, 'demo-token')
      setUser(u); setToken('demo-token')
      return { ok: true }
    }

    if (!supabase) {
      return { ok: false, error: 'Auth is not configured. Try a demo account.' }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (/not confirmed/i.test(error.message)) {
        return { ok: false, error: 'Email not verified — check your inbox.' }
      }
      return { ok: false, error: error.message || 'Login failed.' }
    }

    const profile = await fetchProfile(data.user.id)
    if (!profile) {
      return { ok: false, error: 'Logged in, but profile not found. Contact support.' }
    }
    setUser(profile)
    setToken(data.session.access_token)
    return { ok: true }
  }, [])

  // ── register ──────────────────────────────────────────────────────────────
  const register = useCallback(async (data: RegisterData) => {
    try {
      const res  = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) return { ok: false, error: json.error ?? 'Registration failed.' }
      return { ok: true, autoConfirmed: !!json.autoConfirmed }
    } catch {
      return { ok: false, error: 'Cannot reach the server. Is it running?' }
    }
  }, [])

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    persistLocal(null, null)
    setUser(null); setToken(null)
    if (supabase) {
      await supabase.auth.signOut().catch(() => {})
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
