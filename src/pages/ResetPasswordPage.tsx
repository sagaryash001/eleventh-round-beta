import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { validatePassword, getPasswordRules } from '../lib/passwordValidation'
import Navbar from '../components/Navbar'

// ── Inline SVG eye icons (no external dependency) ─────────────────────────────
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

type PageState = 'loading' | 'ready' | 'no-session' | 'success'

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>('loading')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [showConf,  setShowConf]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [focused,   setFocused]   = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!supabase) { setPageState('no-session'); return }

    // detectSessionInUrl=true means Supabase parses the recovery hash on init.
    // getSession() will already see the recovery session if the hash was present.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setPageState('ready')
      }
      // Else wait for PASSWORD_RECOVERY event (handles slow initialization).
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setPageState('ready')
      }
    })

    // Timeout fallback — if no recovery session within 5s, show error.
    const timer = setTimeout(() => {
      setPageState(prev => prev === 'loading' ? 'no-session' : prev)
    }, 5000)

    return () => { subscription.unsubscribe(); clearTimeout(timer) }
  }, [])

  const rules      = getPasswordRules(password)
  const pwValid    = validatePassword(password)
  const canSubmit  = pwValid && password === confirm && !saving

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!pwValid) {
      setError('Password does not meet the requirements below.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!supabase) {
      setError('Auth is not configured.')
      return
    }

    setSaving(true)
    const { error: sbError } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (sbError) {
      setError(sbError.message || 'Could not update password. The link may have expired.')
      return
    }

    setPageState('success')
    // Sign out so user logs in fresh with new password, then redirect.
    await supabase.auth.signOut().catch(() => {})
    setTimeout(() => navigate('/login', { replace: true }), 2500)
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', right: '-5%', top: '-5%', width: '55%', height: '80%',
          background: 'radial-gradient(ellipse at 80% 30%, rgba(139,0,0,0.10) 0%, transparent 65%)',
        }} />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-24 relative z-10">
        <div className="w-full max-w-[440px]">

          <div className="text-center mb-10">
            <Link to="/" className="no-underline font-display text-off-white uppercase tracking-widest" style={{ fontSize: 22 }}>
              Eleventh Round
            </Link>
            <p className="font-condensed text-[11px] tracking-[0.3em] uppercase text-gray-3 mt-2">
              Set New Password
            </p>
          </div>

          <div className="bg-charcoal border border-charcoal-3 p-10 relative overflow-hidden"
               style={{ borderLeft: '2px solid #8b0000' }}>
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background: 'radial-gradient(ellipse at 80% 10%, rgba(139,0,0,0.06) 0%, transparent 60%)' }} />

            <div className="relative z-10">

              {/* ── Loading ─────────────────────────────────────────────────── */}
              {pageState === 'loading' && (
                <div className="text-center py-8">
                  <div className="flex justify-center mb-5">
                    <div className="w-8 h-8 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
                  </div>
                  <p className="font-condensed text-[12px] text-gray-3">Verifying reset link…</p>
                </div>
              )}

              {/* ── No session / expired ─────────────────────────────────────── */}
              {pageState === 'no-session' && (
                <div className="text-center">
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'rgba(139,0,0,0.12)', border: '1.5px solid #4a4846',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7a7672" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                  <h2 className="font-display text-off-white uppercase mb-3"
                      style={{ fontSize: 'clamp(26px,3.5vw,36px)', lineHeight: 0.92 }}>
                    Link Expired
                  </h2>
                  <p className="font-condensed text-[12px] text-gray-3 leading-relaxed mb-6">
                    This reset link is invalid or has expired. Request a new one.
                  </p>
                  <Link to="/forgot-password" className="btn-primary" style={{ display: 'inline-block' }}>
                    Request New Link
                  </Link>
                  <p className="font-condensed text-[10px] text-gray-3 mt-4">
                    <Link to="/login" className="text-blood-glow hover:text-off-white transition-colors no-underline font-bold">
                      ← Back to Sign In
                    </Link>
                  </p>
                </div>
              )}

              {/* ── Success ──────────────────────────────────────────────────── */}
              {pageState === 'success' && (
                <div className="text-center">
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(139,0,0,0.15)', border: '1.5px solid #8b0000',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 24px',
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                         stroke="#C41E3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h2 className="font-display text-off-white uppercase mb-4"
                      style={{ fontSize: 'clamp(28px,3.5vw,40px)', lineHeight: 0.92 }}>
                    Password Updated
                  </h2>
                  <p className="font-condensed text-[12px] text-gray-2 leading-relaxed mb-2">
                    Your password has been set. Redirecting to sign in…
                  </p>
                  <div className="w-full h-0.5 bg-charcoal-3 overflow-hidden mt-4">
                    <div className="h-full bg-blood-glow" style={{ animation: 'resetProgress 2.5s linear forwards' }} />
                  </div>
                </div>
              )}

              {/* ── Form ─────────────────────────────────────────────────────── */}
              {pageState === 'ready' && (
                <>
                  <div className="sec-label mb-2">New Password</div>
                  <h1 className="font-display text-off-white uppercase mb-6"
                      style={{ fontSize: 'clamp(30px,3.5vw,44px)', lineHeight: 0.92 }}>
                    Reset Password
                  </h1>

                  <form onSubmit={handleSubmit} className="space-y-4">

                    {/* New password */}
                    <div>
                      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          onFocus={() => setFocused('pw')}
                          onBlur={() => setFocused(null)}
                          placeholder="Min. 8 characters"
                          required
                          autoFocus
                          className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3 pr-11 outline-none transition-all duration-200 placeholder:text-gray-3"
                          style={{ borderColor: focused === 'pw' ? '#8b0000' : '#222226' }}
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

                      {/* Password rules */}
                      {password && (
                        <div className="mt-2 space-y-1">
                          {rules.map(r => (
                            <div key={r.id} className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold" style={{ color: r.passed ? '#00c060' : '#4a4846' }}>
                                {r.passed ? '✓' : '○'}
                              </span>
                              <span className="font-condensed text-[10px] tracking-wide"
                                    style={{ color: r.passed ? '#6aab6a' : '#4a4846' }}>
                                {r.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Confirm password */}
                    <div>
                      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConf ? 'text' : 'password'}
                          value={confirm}
                          onChange={e => setConfirm(e.target.value)}
                          onFocus={() => setFocused('conf')}
                          onBlur={() => setFocused(null)}
                          placeholder="••••••••"
                          required
                          className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3 pr-11 outline-none transition-all duration-200 placeholder:text-gray-3"
                          style={{ borderColor: focused === 'conf' ? '#8b0000' : '#222226' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConf(v => !v)}
                          aria-label={showConf ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-3 hover:text-off-white transition-colors p-1"
                        >
                          <EyeIcon visible={showConf} />
                        </button>
                      </div>
                      {confirm && password !== confirm && (
                        <p className="font-condensed text-[10px] text-blood-glow mt-1.5">Passwords do not match.</p>
                      )}
                      {confirm && password === confirm && pwValid && (
                        <p className="font-condensed text-[10px] mt-1.5" style={{ color: '#00c060' }}>✓ Passwords match</p>
                      )}
                    </div>

                    {error && (
                      <div className="font-condensed text-[11px] tracking-wide text-blood-glow bg-blood/10 border border-blood/25 px-4 py-2.5">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="btn-primary w-full text-center mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ display: 'block' }}
                    >
                      {saving ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="inline-block w-3 h-3 border border-off-white/40 border-t-off-white rounded-full animate-spin" />
                          Updating…
                        </span>
                      ) : 'Set New Password'}
                    </button>
                  </form>

                  <p className="font-condensed text-[10px] tracking-wide text-gray-3 mt-5 text-center">
                    <Link to="/login" className="text-blood-glow hover:text-off-white transition-colors no-underline font-bold">
                      ← Back to Sign In
                    </Link>
                  </p>
                </>
              )}

            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes resetProgress { from { width: 0% } to { width: 100% } }
      `}</style>
    </div>
  )
}
