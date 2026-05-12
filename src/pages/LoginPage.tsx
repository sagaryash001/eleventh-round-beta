import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Navbar from '../components/Navbar'

const DEMO_CREDENTIALS = [
  { role: 'Fighter',  email: 'fighter@demo.com', pass: 'fighter123', hint: 'Fighter dashboard' },
  { role: 'Manager',  email: 'manager@demo.com', pass: 'manager123', hint: 'Manager operations' },
  { role: 'Admin',    email: 'admin@demo.com',   pass: 'admin123',   hint: 'Full platform admin' },
]

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [focused,  setFocused]  = useState<string | null>(null)
  const { login, user }         = useAuth()
  const navigate                = useNavigate()

  useEffect(() => {
    if (user) {
      navigate(
        user.role === 'fighter' ? '/dashboard/fighter' :
        user.role === 'manager' ? '/dashboard/manager' :
        '/dashboard/admin'
      )
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? 'Login failed')
    }
    // navigation handled by useEffect above
  }

  const fillDemo = (email: string, pass: string) => {
    setEmail(email)
    setPassword(pass)
    setError('')
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
          background: 'radial-gradient(ellipse at 20% 80%, rgba(60,0,0,0.1) 0%, transparent 65%)',
        }} />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-24 relative z-10">
        <div className="w-full max-w-[440px]">
          {/* Logo */}
          <div className="text-center mb-10">
            <Link to="/" className="font-condensed font-extrabold text-[22px] tracking-[0.08em] uppercase text-off-white no-underline">
              <span className="text-blood-glow">XI</span> Eleventh Round
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
                    style={{
                      borderColor: focused === 'email' ? '#8b0000' : '#222226',
                    }}
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3 outline-none transition-all duration-200 placeholder:text-gray-3"
                    style={{
                      borderColor: focused === 'password' ? '#8b0000' : '#222226',
                    }}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="font-condensed text-[11px] tracking-wide text-blood-glow bg-blood/10 border border-blood/25 px-4 py-2.5">
                    {error}
                  </div>
                )}

                {/* Submit */}
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

              {/* Role detection note */}
              <p className="font-condensed text-[10px] tracking-wide text-gray-3 mt-5 text-center">
                Your dashboard role is auto-detected from your credentials.
              </p>
            </div>
          </div>

          {/* Demo credentials */}
          <div className="mt-6">
            <div className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 mb-3 text-center">
              Demo Accounts
            </div>
            <div className="space-y-2">
              {DEMO_CREDENTIALS.map(d => (
                <button
                  key={d.role}
                  onClick={() => fillDemo(d.email, d.pass)}
                  className="w-full bg-charcoal-2 border border-charcoal-3 px-4 py-3 flex items-center justify-between hover:border-blood/40 transition-colors cursor-pointer group"
                >
                  <div className="text-left">
                    <div className="font-condensed text-[12px] font-bold tracking-wide text-off-white group-hover:text-blood-glow transition-colors">
                      {d.role}
                    </div>
                    <div className="font-condensed text-[10px] tracking-wide text-gray-3">{d.email}</div>
                  </div>
                  <span className="font-condensed text-[10px] tracking-[0.25em] uppercase text-gray-3 group-hover:text-blood-glow transition-colors">
                    Use →
                  </span>
                </button>
              ))}
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
