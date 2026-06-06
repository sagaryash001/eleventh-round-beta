import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import Navbar from '../components/Navbar'

type Status = 'verifying' | 'success' | 'error'

export default function VerifyEmailPage() {
  const { user } = useAuth()
  const navigate        = useNavigate()
  const [status, setStatus] = useState<Status>('verifying')
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Supabase auto-handles the verification redirect (detectSessionInUrl=true).
    // We just wait for the session to materialize, then trigger the welcome-email hook.
    if (!supabase) {
      setStatus('error')
      setMessage('Auth backend not configured. Contact support.')
      return
    }

    let cancelled = false
    const start = Date.now()
    const MAX_WAIT_MS = 8000

    const poll = async () => {
      const { data } = await supabase!.auth.getSession()
      if (cancelled) return

      if (data.session?.user) {
        // Fire welcome-email hook (server picks up role/subdomain from profile)
        apiFetch('/api/auth/post-verify', {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${data.session.access_token}`,
          },
        }).catch(() => { /* non-fatal */ })

        setStatus('success')

        // Redirect after 2.5s — useAuth will have populated `user` by then
        setTimeout(() => {
          const role = user?.role
          const complete = user?.onboarding_complete
          if (!complete && role !== 'admin') {
            navigate(
              role === 'fighter' ? '/onboarding/fighter' :
              role === 'manager' ? '/onboarding/manager' :
              '/onboarding/sponsor',
              { replace: true }
            )
            return
          }
          navigate(
            role === 'manager' ? '/dashboard/manager' :
            role === 'admin'   ? '/dashboard/admin'   :
            role === 'sponsor' ? '/dashboard/sponsor' :
            '/dashboard/fighter',
            { replace: true }
          )
        }, 2500)
        return
      }

      if (Date.now() - start > MAX_WAIT_MS) {
        setStatus('error')
        setMessage('Verification link invalid or expired. Try requesting a new one.')
        return
      }
      setTimeout(poll, 400)
    }

    poll()
    return () => { cancelled = true }
  }, [navigate, user?.role])

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />

      <div className="flex flex-1 items-center justify-center px-6 py-24 relative z-10">
        <div className="w-full max-w-[440px]">

          {/* Logo */}
          <div className="text-center mb-10">
            <Link to="/" className="no-underline font-display text-off-white uppercase tracking-widest" style={{ fontSize: 22 }}>
              Eleventh Round
            </Link>
          </div>

          <div className="bg-charcoal border border-charcoal-3 p-10 text-center relative overflow-hidden"
               style={{ borderLeft:'2px solid #8b0000' }}>
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background:'radial-gradient(ellipse at 50% 0%, rgba(139,0,0,0.07) 0%, transparent 60%)' }} />

            <div className="relative z-10">
              {/* Verifying */}
              {status === 'verifying' && (
                <>
                  <div className="flex justify-center mb-6">
                    <div className="w-10 h-10 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
                  </div>
                  <div className="sec-label mb-2 justify-center">Please Wait</div>
                  <h2 className="font-display text-off-white uppercase mb-3"
                      style={{ fontSize:'clamp(28px,3.5vw,42px)', lineHeight:0.92 }}>
                    Verifying…
                  </h2>
                  <p className="font-narrow text-gray-2" style={{ fontSize:13 }}>
                    Confirming your email address.
                  </p>
                </>
              )}

              {/* Success */}
              {status === 'success' && (
                <>
                  <div style={{
                    width:56, height:56, borderRadius:'50%',
                    background:'rgba(139,0,0,0.15)', border:'1.5px solid #8b0000',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    margin:'0 auto 24px',
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                      stroke="#C41E3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div className="sec-label mb-2 justify-center">Verified</div>
                  <h2 className="font-display text-off-white uppercase mb-4"
                      style={{ fontSize:'clamp(28px,3.5vw,42px)', lineHeight:0.92 }}>
                    You're In.
                  </h2>
                  <p className="font-narrow text-gray-2 mb-6" style={{ fontSize:13 }}>
                    Email confirmed. Redirecting you to your dashboard…
                  </p>
                  <div className="w-full h-0.5 bg-charcoal-3 overflow-hidden">
                    <div className="h-full bg-blood-glow" style={{ animation:'verifyProgress 2.5s linear forwards' }} />
                  </div>
                </>
              )}

              {/* Error */}
              {status === 'error' && (
                <>
                  <div style={{
                    width:56, height:56, borderRadius:'50%',
                    background:'rgba(139,0,0,0.12)', border:'1.5px solid #4a4846',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    margin:'0 auto 24px',
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                      stroke="#7a7672" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </div>
                  <div className="sec-label mb-2 justify-center">Error</div>
                  <h2 className="font-display text-off-white uppercase mb-4"
                      style={{ fontSize:'clamp(28px,3.5vw,42px)', lineHeight:0.92 }}>
                    Link Invalid
                  </h2>
                  <p className="font-narrow text-gray-2 mb-6" style={{ fontSize:13 }}>
                    {message}
                  </p>
                  <Link to="/login" className="btn-primary">Back to Sign In</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes verifyProgress { from { width: 0% } to { width: 100% } }
      `}</style>
    </div>
  )
}
