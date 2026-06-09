import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')
  const [focused, setFocused] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Please enter your email address.'); return }
    if (!supabase)     { setError('Auth is not configured. Contact support.'); return }

    setLoading(true)
    const { error: sbError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)

    if (sbError) {
      setError(sbError.message || 'Could not send reset email. Please try again.')
      return
    }
    setSent(true)
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
              Password Recovery
            </p>
          </div>

          <div className="bg-charcoal border border-charcoal-3 p-10 relative overflow-hidden"
               style={{ borderLeft: '2px solid #8b0000' }}>
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background: 'radial-gradient(ellipse at 80% 10%, rgba(139,0,0,0.06) 0%, transparent 60%)' }} />

            <div className="relative z-10">
              {sent ? (
                // ── Success state ──────────────────────────────────────────────
                <>
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
                  <h2 className="font-display text-off-white uppercase mb-4 text-center"
                      style={{ fontSize: 'clamp(28px,3.5vw,40px)', lineHeight: 0.92 }}>
                    Check Your Email
                  </h2>
                  <p className="font-condensed text-[13px] text-gray-2 leading-relaxed text-center mb-6">
                    A password reset link has been sent to{' '}
                    <span className="text-off-white font-bold">{email}</span>.
                    Check your inbox and spam folder.
                  </p>
                  <p className="font-condensed text-[11px] text-gray-3 text-center leading-relaxed">
                    The link expires in 1 hour. Didn't get it?{' '}
                    <button type="button"
                      onClick={() => { setSent(false); setError('') }}
                      className="text-blood-glow hover:text-off-white transition-colors bg-transparent border-0 cursor-pointer font-bold">
                      Try again
                    </button>
                  </p>
                </>
              ) : (
                // ── Form ──────────────────────────────────────────────────────
                <>
                  <div className="sec-label mb-2">Recovery</div>
                  <h1 className="font-display text-off-white uppercase mb-3"
                      style={{ fontSize: 'clamp(30px,3.5vw,44px)', lineHeight: 0.92 }}>
                    Forgot Password?
                  </h1>
                  <p className="font-condensed text-[12px] text-gray-3 mb-7 leading-relaxed">
                    Enter your account email and we'll send you a secure reset link.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        placeholder="you@example.com"
                        required
                        autoFocus
                        className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3 outline-none transition-all duration-200 placeholder:text-gray-3"
                        style={{ borderColor: focused ? '#8b0000' : '#222226' }}
                      />
                    </div>

                    {error && (
                      <div className="font-condensed text-[11px] tracking-wide text-blood-glow bg-blood/10 border border-blood/25 px-4 py-2.5">
                        {error}
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
                          Sending…
                        </span>
                      ) : 'Send Reset Link'}
                    </button>
                  </form>
                </>
              )}

              <p className="font-condensed text-[10px] tracking-wide text-gray-3 mt-6 text-center">
                <Link to="/login" className="text-blood-glow hover:text-off-white transition-colors no-underline font-bold">
                  ← Back to Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
