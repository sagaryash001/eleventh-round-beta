import React, { createContext, useContext, useState, useCallback } from 'react'

export type UserRole = 'fighter' | 'manager' | 'admin'

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
  login:    (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  register: (data: RegisterData) => Promise<{ ok: boolean; error?: string }>
  logout:   () => void
}

// ── Demo credentials kept for development convenience ────────────────────────
const DEMO: Record<string, AuthUser & { password: string }> = {
  'fighter@demo.com': { id: 'f1', name: 'Marcus Torres', role: 'fighter', email: 'fighter@demo.com', password: 'fighter123' },
  'manager@demo.com': { id: 'm1', name: 'Ray Callahan',  role: 'manager', email: 'manager@demo.com', password: 'manager123' },
  'admin@demo.com':   { id: 'a1', name: 'Jordan Hayes',  role: 'admin',   email: 'admin@demo.com',   password: 'admin123'   },
}

const AuthContext = createContext<AuthContextValue | null>(null)

function load(): { user: AuthUser | null; token: string | null } {
  try {
    const token = localStorage.getItem('er_token')
    const raw   = localStorage.getItem('er_user')
    return { token, user: raw ? JSON.parse(raw) : null }
  } catch { return { token: null, user: null } }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const init = load()
  const [user,  setUser]  = useState<AuthUser | null>(init.user)
  const [token, setToken] = useState<string | null>(init.token)

  const persist = (u: AuthUser | null, t: string | null) => {
    setUser(u); setToken(t)
    if (u && t) {
      localStorage.setItem('er_user',  JSON.stringify(u))
      localStorage.setItem('er_token', t)
    } else {
      localStorage.removeItem('er_user')
      localStorage.removeItem('er_token')
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    // Demo shortcut — works without the backend running
    const demo = DEMO[email.toLowerCase()]
    if (demo && demo.password === password) {
      await new Promise(r => setTimeout(r, 700))
      const { password: _pw, ...u } = demo
      persist(u, 'demo-token')
      return { ok: true }
    }

    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error ?? 'Login failed.' }
      persist(data.user as AuthUser, data.token)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Cannot reach the server. Is it running?' }
    }
  }, [])

  const register = useCallback(async (data: RegisterData) => {
    try {
      const res  = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) return { ok: false, error: json.error ?? 'Registration failed.' }
      return { ok: true }
    } catch {
      return { ok: false, error: 'Cannot reach the server. Is it running?' }
    }
  }, [])

  const logout = useCallback(() => persist(null, null), [])

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
