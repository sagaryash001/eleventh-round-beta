import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase, siteUrl } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { getSponsorStatus } from '../lib/api/sponsors'
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
  register:     (data: RegisterData) => Promise<{ ok: boolean; error?: string; autoConfirmed?: boolean; code?: string; emailFailed?: boolean }>
  logout:       () => Promise<void>
  refreshUser:  () => Promise<AuthUser | null>
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

  let onboarded = !!data.onboarding_complete

  // Backward-compat: an existing sponsor who already has a company profile is
  // onboarded — even if profiles.onboarding_complete is stale/false (e.g. their
  // sponsor_profiles row predates the flag being set). RLS can hide
  // sponsor_profiles from the client, so we reconcile via the service-role
  // backend (/api/sponsor/status), which also self-heals the stored flag. The
  // call is time-boxed and fail-safe: a slow/down backend never blocks login —
  // the sponsor is simply treated as not-yet-onboarded and routed to setup.
  if (data.role === 'sponsor' && !onboarded) {
    try {
      const status = await Promise.race([
        getSponsorStatus(),
        new Promise<{ onboarded: boolean }>((_, reject) =>
          setTimeout(() => reject(new Error('reconcile-timeout')), 3500)),
      ])
      if (status?.onboarded) onboarded = true
    } catch (e) {
      console.error('[auth] sponsor onboarding reconcile failed:', (e as Error)?.message)
    }
  }

  return {
    id:                  data.id,
    email:               data.email,
    name:                data.name,
    role:                data.role as UserRole,
    subdomain:           data.subdomain,
    onboarding_complete: onboarded,
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

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    if (!data.session?.user) return null
    const profile = await fetchProfile(data.session.user.id)
    if (profile) {
      setUser(profile)
      setToken(data.session.access_token)
    }
    return profile
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
    if (!supabase) return { ok: false, error: 'Auth is not configured.' }
    const role: UserRole = data.accountType === 'fighter' ? 'fighter'
      : data.accountType === 'sponsor' ? 'sponsor' : 'manager'

    // Create the auth user via the NORMAL client signup — the reliable way to
    // send the confirmation email (Supabase sends it through its configured SMTP /
    // SendGrid). Admin createUser does NOT send a signup email. Signup details
    // ride in user_metadata; the backend builds the profile at /post-verify
    // (authenticated), so no profile data is trusted from an unauthenticated call.
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email:    data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${siteUrl}/verify-email`,
        data: {
          name: data.name, account_type: data.accountType, role,
          team_name: data.teamName ?? null, subdomain: data.subdomain ?? null,
          onboarding: data.onboarding ?? null,
        },
      },
    })

    if (signUpErr) {
      // Surface as an email-send failure so the UI shows a truthful retry state
      // (never "check your inbox" when nothing was sent).
      console.error('[auth-confirmation-email] failed', {
        message: signUpErr.message,
        status:  (signUpErr as { status?: number }).status,
        name:    signUpErr.name,
      })
      return { ok: false, emailFailed: true, error: signUpErr.message || 'Could not send the verification email.' }
    }

    // Supabase obfuscates an existing email by returning a user with NO identities.
    const identities = signUpData?.user?.identities
    if (signUpData?.user && Array.isArray(identities) && identities.length === 0) {
      return { ok: false, code: 'exists', error: 'An account with this email already exists.' }
    }
    if (!signUpData?.user?.id) {
      return { ok: false, emailFailed: true, error: 'Signup did not return a user. Please try again.' }
    }

    // If email confirmation is disabled at the project level (dev), signUp returns
    // a session immediately — bootstrap the profile via the authenticated
    // post-verify endpoint and proceed straight to the dashboard.
    if (signUpData.session) {
      try {
        await apiFetch('/api/auth/post-verify', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signUpData.session.access_token}` },
        })
      } catch (err) {
        console.error('[auth] post-verify bootstrap error:', (err as Error)?.message)
      }
      await refreshUser()
      return { ok: true, autoConfirmed: true }
    }

    // Email confirmation required: the email is on its way. The profile is created
    // at verify time. Truthful "check your inbox" — signUp accepted the send.
    return { ok: true }
  }, [refreshUser])

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
