import React, { createContext, useContext, useState, useEffect } from 'react'

export type UserRole = 'fighter' | 'manager' | 'admin'

export interface AuthUser {
  id: string
  name: string
  role: UserRole
  email: string
  avatar?: string
}

interface AuthContextValue {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
}

// Demo credentials
const DEMO_USERS: Record<string, AuthUser & { password: string }> = {
  'fighter@demo.com': { id: 'f1', name: 'Marcus Torres', role: 'fighter', email: 'fighter@demo.com', password: 'fighter123' },
  'manager@demo.com': { id: 'm1', name: 'Ray Callahan',  role: 'manager', email: 'manager@demo.com', password: 'manager123' },
  'admin@demo.com':   { id: 'a1', name: 'Jordan Hayes',  role: 'admin',   email: 'admin@demo.com',   password: 'admin123' },
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const s = localStorage.getItem('er_user')
      return s ? JSON.parse(s) : null
    } catch { return null }
  })

  const login = async (email: string, password: string) => {
    await new Promise(r => setTimeout(r, 900)) // simulate latency
    const found = DEMO_USERS[email.toLowerCase()]
    if (!found || found.password !== password) {
      return { ok: false, error: 'Invalid credentials. Try the demo accounts below.' }
    }
    const { password: _pw, ...u } = found
    setUser(u)
    localStorage.setItem('er_user', JSON.stringify(u))
    return { ok: true }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('er_user')
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
