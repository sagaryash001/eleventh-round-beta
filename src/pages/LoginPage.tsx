import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

// ── Inline SVG eye icon (no external dependency) ──────────────────────────────
function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

type OtpState = 'idle' | 'sending' | 'sent' | 'error'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [focused,  setFocused]  = useState<string | null>(null)

  // Passwordless / magic-link state
  const [otpState,  setOtpState]  = useState<OtpState>('idle')
  const [otpError,  setOtpError]  = useState('')

  const { login, user } = useAuth()
  const navigate        = useNavigate()

  useEffect(() => {
    if (!user) return
    if (!user.onboarding_complete && user.role !== 'admin') {
      navigate(
        user.role === 'fighter' ? '/onboarding/fighter' :
        user.role === 'manager' ? '/onboarding/manager' :
        '/onboarding/sponsor',
        { replace: true }
      )
      return
    }
    navigate(
      user.role === 'fighter' ? '/dashboard/fighter' :
      user.role === 'manager' ? '/dashboard/manager' :
      user.role === 'sponsor' ? '/dashboard/sponsor' :
      '/dashboard/admin',
      { replace: true }
    )
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (!result.ok) {
      // Friendly message for unverified emails (handled in useAuth, surfaced here).
      setError(result.error ?? 'Login failed.')
    }
  }

  const handleMagicLink = async () => {
    setOtpError('')
    if (!email.trim()) { setOtpError('Enter your email above first.'); return }
    if (!supabase)     { setOtpError('Auth is not configured.'); return }

    setOtpState('sending')
    const { error: sbErr } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser:  false,               // only existing accounts
        emailRedirectTo:   window.location.origin,
      },
    })

    if (sbErr) {
      setOtpState('error')
      setOtpError(sbErr.message || 'Could not send magic link.')
      return
    }
    setOtpState('sent')
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', right: '-5%', top: '-5%', width: '55%', height: '80%',
          background: 'radial-gradient(ellipse at 80% 30%, rgba(139,0,0,0.12) 0%, transparent 65%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '5%', left: '5%', width: '40%', height: '50%',
          background: 'radial-gradient(ellipse at 20% 80%, rgba(60,0,0,0.10) 0%, transparent 65%)',
        }} />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-24 relative z-10">
        <div className="w-full max-w-[440px]">

          {/* Logo */}
          <div className="text-center mb-10">
            <Link to="/" className="no-underline font-display text-off-white uppercase tracking-widest" style={{ fontSize: 22 }}>
              Eleventh Round
            </Link>
            <p className="font-condensed text-[11px] tracking-[0.3em] uppercase text-gray-3 mt-2">
              Career Infrastructure · Combat Sports
            </p>
          </div>

          {/* Card */}
          <div className="bg-charcoal border border-charcoal-3 p-10 relative overflow-hidden"
               style={{ borderLeft: '2px solid #8b0000' }}>
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background: 'radial-gradient(ellipse at 80% 10%, rgba(139,0,0,0.07) 0%, transparent 60%)' }} />

            <div className="relative z-10">
              <div className="sec-label mb-2">Access Your Dashboard</div>
              <h1 className="font-display text-off-white uppercase mb-8"
                  style={{ fontSize: 'clamp(36px,4vw,52px)', lineHeight: 0.92 }}>
                Sign In
              </h1>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3 outline-none transition-all duration-200 placeholder:text-gray-3"
                    style={{ borderColor: focused === 'email' ? '#8b0000' : '#222226' }}
                  />
                </div>

                {/* Password with eye toggle */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3">
                      Password
                    </label>
                    <Link to="/forgot-password"
                          className="font-condensed text-[10px] tracking-wide text-gray-3 hover:text-blood-glow transition-colors no-underline">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3 pr-11 outline-none transition-all duration-200 placeholder:text-gray-3"
                      style={{ borderColor: focused === 'password' ? '#8b0000' : '#222226' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-3 hover:text-off-white transition-colors p-1"
                    >
                      <EyeIcon visible={showPw} />
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="font-condensed text-[11px] tracking-wide text-blood-glow bg-blood/10 border border-blood/25 px-4 py-2.5">
                    {error}
                    {/* Extra hint for unverified email */}
                    {/verify|confirm/i.test(error) && (
                      <p className="mt-1 text-gray-3">
                        Check your inbox for a verification email from Eleventh Round.
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full text-center mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ display: 'block' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-3 h-3 border border-off-white/40 border-t-off-white rounded-full animate-spin" />
                      Authenticating…
                    </span>
                  ) : 'Access Dashboard'}
                </button>
              </form>

              {/* ── Passwordless / magic-link divider ──────────────────────── */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-charcoal-3" />
                <span className="font-condensed text-[9px] font-bold uppercase tracking-[0.3em] text-gray-3">or</span>
                <div className="flex-1 h-px bg-charcoal-3" />
              </div>

              {otpState === 'sent' ? (
                <div className="font-condensed text-[11px] tracking-wide text-center text-gray-2 bg-charcoal-2 border border-charcoal-3 px-4 py-3">
                  ✓ Magic link sent to <span className="text-off-white font-bold">{email}</span>.
                  Check your inbox.
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={handleMagicLink}
                    disabled={otpState === 'sending'}
                    className="w-full font-condensed text-[11px] font-bold tracking-[0.2em] uppercase px-4 py-3 border border-charcoal-3 text-gray-2 hover:border-blood/40 hover:text-off-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {otpState === 'sending' ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-3 h-3 border border-gray-3/40 border-t-gray-2 rounded-full animate-spin" />
                        Sending Link…
                      </span>
                    ) : '✉ Email me a passwordless link'}
                  </button>
                  <p className="font-condensed text-[9px] text-gray-3 text-center mt-1.5 tracking-wide">
                    One-click sign in — no password required
                  </p>
                  {otpError && (
                    <p className="font-condensed text-[10px] text-blood-glow mt-2 text-center">{otpError}</p>
                  )}
                </div>
              )}

              {/* ── Footer links ───────────────────────────────────────────── */}
              <p className="font-condensed text-[10px] tracking-wide text-gray-3 mt-6 text-center">
                Don't have an account?{' '}
                <Link to="/register" className="text-blood-glow hover:text-off-white transition-colors no-underline font-bold">
                  Create one →
                </Link>
              </p>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link to="/" className="font-condensed text-[11px] tracking-[0.2em] uppercase text-gray-3 hover:text-off-white transition-colors no-underline">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
