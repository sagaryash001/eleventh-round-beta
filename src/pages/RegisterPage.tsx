import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth, RegisterData } from '../hooks/useAuth'
import { apiFetch } from '../lib/api'
import { validatePassword, getPasswordRules } from '../lib/passwordValidation'
import ResendVerification from '../components/ResendVerification'
import Navbar from '../components/Navbar'

// ── Pending manager-invite context (from GET /api/auth/pending-invite) ─────────
interface PendingInvite {
  hasPendingInvite: boolean
  accountState?: 'none' | 'unverified' | 'verified' | 'non_fighter'
  managerName?: string | null
  teamName?: string | null
}

// Invite-aware card shown when the email has a pending manager roster invite.
// Cases A–D map to the fighter's account state for that email.
function InviteCard({ invite, email, onCreateAccount }: {
  invite: PendingInvite; email: string; onCreateAccount: () => void
}) {
  const who = invite.managerName || invite.teamName || 'A manager'
  const state = invite.accountState ?? 'none'

  const Shell = ({ label, title, children }: { label: string; title: string; children: React.ReactNode }) => (
    <div className="bg-charcoal border border-charcoal-3 p-8 relative overflow-hidden text-center"
         style={{ borderLeft: '2px solid #8b0000' }}>
      <div className="relative z-10">
        <div className="sec-label mb-2 justify-center">{label}</div>
        <h2 className="font-display text-off-white uppercase mb-4" style={{ fontSize: 'clamp(26px,3.4vw,40px)', lineHeight: 0.95 }}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
  const copyCls = 'font-narrow text-gray-1 leading-relaxed mb-6'
  const copySty = { fontSize: 14, maxWidth: 380, margin: '0 auto 24px' } as React.CSSProperties

  // Case D — email belongs to a non-fighter account.
  if (state === 'non_fighter') {
    return (
      <Shell label="Roster Invite" title="Wrong account type">
        <p className={copyCls} style={copySty}>
          This invite is for a <strong className="text-off-white">fighter</strong> account. Sign in with a fighter
          account, or contact support if you think this is a mistake.
        </p>
        <Link to="/login" className="btn-primary inline-block">Sign In</Link>
      </Shell>
    )
  }

  // Case C — verified fighter account already exists.
  if (state === 'verified') {
    return (
      <Shell label="Roster Invite" title="Roster invite pending">
        <p className={copyCls} style={copySty}>
          <strong className="text-off-white">{who}</strong> invited you to join their roster. Sign in to review and
          respond to the invite from your fighter dashboard.
        </p>
        <Link to="/login" className="btn-primary inline-block">Sign In</Link>
      </Shell>
    )
  }

  // Case B — account exists but email not verified.
  if (state === 'unverified') {
    return (
      <Shell label="Roster Invite" title="Verify your email to respond to the roster invite">
        <p className={copyCls} style={copySty}>
          Your account already exists. Verify your email, then accept or decline the invite from
          <strong className="text-off-white"> {who}</strong> in your fighter dashboard.
        </p>
        <ResendVerification email={email.trim()} cooldownSeconds={60} className="mb-5" />
        <p className="font-condensed text-[10px] text-gray-3 text-center">
          Already verified?{' '}
          <Link to="/login" className="text-blood-glow hover:text-off-white transition-colors no-underline">Sign In</Link>
        </p>
      </Shell>
    )
  }

  // Case A — no account yet for this email.
  return (
    <Shell label="Roster Invite" title="You've been invited to join a roster">
      <p className={copyCls} style={copySty}>
        <strong className="text-off-white">{who}</strong> invited you to join their roster on The Eleventh Round.
        Create your fighter account to review and respond to the invite.
      </p>
      <button type="button" onClick={onCreateAccount} className="btn-primary inline-block">
        Create Fighter Account
      </button>
      <p className="font-condensed text-[10px] text-gray-3 text-center mt-5">
        Already have an account?{' '}
        <Link to="/login" className="text-blood-glow hover:text-off-white transition-colors no-underline">Sign In</Link>
      </p>
    </Shell>
  )
}

// ── Inline SVG eye icon ───────────────────────────────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────────────────────
type Step = 'account' | 'role' | 'goal' | 'problems' | 'pipeline' | 'team' | 'done'

interface FormState {
  // Step: account
  name:     string
  email:    string
  password: string
  confirm:  string
  // Step: role (Q1)
  accountType: 'fighter' | 'management' | 'promotion' | 'sponsor' | ''
  // Step: goal (Q2)
  goal: string
  // Step: problems (Q3)
  commonProblem: string
  // Step: pipeline (Q4 + Q5)
  endGoal:       string
  upcomingEvent: 'yes' | 'no' | ''
  // Step: team
  teamName:  string
  subdomain: string
}

const STEPS: Step[] = ['account', 'role', 'goal', 'problems', 'pipeline', 'team', 'done']

const GOAL_OPTIONS = [
  { value: 'track_onboarding',  label: 'Track onboarding long-term',         desc: 'Monitor fighter development and readiness over time.' },
  { value: 'professionalism',   label: 'Improve professionalism standards',   desc: 'Set and enforce conduct, media, and sponsor obligations.' },
  { value: 'sponsor_ready',     label: 'Produce sponsor-ready athlete(s)',    desc: 'Get fighters certified and connected to the sponsor network.' },
]

// ── Input field ───────────────────────────────────────────────────────────────
function Field({
  label, type = 'text', value, onChange, placeholder, hint, autoFocus,
  showEye, eyeVisible, onToggleEye,
}: {
  label: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string; hint?: string; autoFocus?: boolean
  showEye?: boolean; eyeVisible?: boolean; onToggleEye?: () => void
}) {
  const [focused, setFocused] = useState(false)
  const inputType = showEye ? (eyeVisible ? 'text' : 'password') : type
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
        {label}
      </label>
      <div className={showEye ? 'relative' : undefined}>
        <input
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3
                     outline-none transition-all duration-200 placeholder:text-gray-3"
          style={{
            borderColor: focused ? '#8b0000' : '#222226',
            paddingRight: showEye ? '2.75rem' : undefined,
          }}
        />
        {showEye && onToggleEye && (
          <button
            type="button"
            onClick={onToggleEye}
            aria-label={eyeVisible ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-3 hover:text-off-white transition-colors p-1"
          >
            <EyeIcon visible={!!eyeVisible} />
          </button>
        )}
      </div>
      {hint && <p className="font-condensed text-[10px] text-gray-3 mt-1.5 tracking-wide">{hint}</p>}
    </div>
  )
}

// ── Textarea field ────────────────────────────────────────────────────────────
function TextArea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
        {label}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3
                   outline-none transition-all duration-200 placeholder:text-gray-3 resize-none"
        style={{ borderColor: focused ? '#8b0000' : '#222226' }}
      />
    </div>
  )
}

// ── Option card ───────────────────────────────────────────────────────────────
function OptionCard({ label, desc, selected, onClick }: {
  label: string; desc?: string; selected: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left border px-5 py-4 transition-all duration-200 cursor-pointer bg-charcoal-2"
      style={{
        borderColor:  selected ? '#8b0000' : '#222226',
        borderLeft:   selected ? '3px solid #8b0000' : '3px solid transparent',
        background:   selected ? 'rgba(139,0,0,0.08)' : '#141416',
      }}
    >
      <div className="font-condensed font-bold text-[13px] tracking-wide"
        style={{ color: selected ? '#f0ece4' : '#7a7672' }}>
        {label}
      </div>
      {desc && <div className="font-condensed text-[11px] text-gray-3 mt-1 leading-relaxed">{desc}</div>}
    </button>
  )
}

// ── Progress dots ─────────────────────────────────────────────────────────────
function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 20 : 6, height: 4,
          background: i < current ? '#8b0000' : i === current ? '#C41E3A' : '#222226',
          transition: 'all 0.3s cubic-bezier(.25,.46,.45,.94)',
          borderRadius: 2,
        }} />
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const { register, login, user } = useAuth()
  const navigate           = useNavigate()
  const location           = useLocation()
  const [step, setStep]    = useState<Step>('account')
  const [error, setError]  = useState('')
  const [loading, setLoading] = useState(false)
  // Set when registration reports the email is already taken — we offer a
  // resend-verification path rather than a dead-end error.
  const [existingAccount, setExistingAccount] = useState(false)
  // Set when the account was created but the confirmation email failed to send —
  // we show a truthful, recoverable state instead of "check your inbox".
  const [emailFailed, setEmailFailed] = useState(false)
  // Pending manager invite for the entered email (drives the invite-aware UI).
  const [invite, setInvite]                   = useState<PendingInvite | null>(null)
  const [inviteDismissed, setInviteDismissed] = useState(false)
  const [invitedFighter, setInvitedFighter]   = useState(false)
  const inviteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [subStatus, setSubStatus] = useState<'idle'|'checking'|'ok'|'taken'|'invalid'>('idle')
  const subTimer = useRef<ReturnType<typeof setTimeout>|null>(null)

  // Password eye-toggle state for the account step
  const [showPw,   setShowPw]   = useState(false)
  const [showConf, setShowConf] = useState(false)

  const [form, setForm] = useState<FormState>({
    name: '', email: '', password: '', confirm: '',
    accountType: '',
    goal: '',
    commonProblem: '',
    endGoal: '', upcomingEvent: '',
    teamName: '', subdomain: '',
  })

  const set = (key: keyof FormState) => (val: string) =>
    setForm(prev => ({ ...prev, [key]: val }))

  // Redirect if already logged in.
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

  // Auto-suggest subdomain from team name
  useEffect(() => {
    if (!form.teamName) return
    const slug = form.teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setForm(prev => ({ ...prev, subdomain: slug }))
  }, [form.teamName])

  // Debounced subdomain availability check
  useEffect(() => {
    if (!form.subdomain) { setSubStatus('idle'); return }
    if (!/^[a-z0-9-]{3,32}$/.test(form.subdomain)) { setSubStatus('invalid'); return }
    if (subTimer.current) clearTimeout(subTimer.current)
    setSubStatus('checking')
    subTimer.current = setTimeout(async () => {
      try {
        const res  = await apiFetch(`/api/auth/check-subdomain/${form.subdomain}`)
        const data = await res.json()
        setSubStatus(data.available ? 'ok' : 'taken')
      } catch { setSubStatus('idle') }
    }, 500)
  }, [form.subdomain])

  // Look up whether an email has a pending manager invite (safe, minimal data).
  const checkInvite = useCallback(async (rawEmail: string) => {
    const e = rawEmail.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setInvite(null); return }
    try {
      const res  = await apiFetch(`/api/auth/pending-invite?email=${encodeURIComponent(e)}`)
      const data = await res.json()
      setInvite(data?.hasPendingInvite ? data : null)
    } catch { setInvite(null) }
  }, [])

  // Prefill + check when arriving via an invite link (?email=...).
  useEffect(() => {
    const qEmail = new URLSearchParams(location.search).get('email')
    if (qEmail) {
      setForm(prev => ({ ...prev, email: qEmail }))
      checkInvite(qEmail)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced invite check as the user types their email on the account step.
  useEffect(() => {
    if (step !== 'account' || inviteDismissed) return
    if (inviteTimer.current) clearTimeout(inviteTimer.current)
    inviteTimer.current = setTimeout(() => checkInvite(form.email), 500)
    return () => { if (inviteTimer.current) clearTimeout(inviteTimer.current) }
  }, [form.email, step, inviteDismissed, checkInvite])

  const showInviteScreen = !!invite?.hasPendingInvite && !inviteDismissed && step !== 'done'

  const stepIdx   = STEPS.indexOf(step)
  const visibleSteps =
    form.accountType === 'sponsor' ? (['account', 'role', 'done'] as Step[]) :
    form.accountType === 'fighter' ? STEPS.filter(s => s !== 'team') :
    STEPS
  const visibleIdx = visibleSteps.indexOf(step)

  const goNext = (next: Step) => { setError(''); setStep(next) }
  const goBack = (prev: Step) => { setError(''); setStep(prev) }

  // ── Step validators ──────────────────────────────────────────────────────
  const submitAccount = () => {
    if (!form.name.trim())  return setError('Please enter your name.')
    if (!form.email.trim()) return setError('Please enter your email.')
    if (!validatePassword(form.password))
      return setError('Password must include uppercase, lowercase, number, special character, and be at least 8 characters.')
    if (form.password !== form.confirm) return setError('Passwords do not match.')
    // Invited fighters are pre-typed as fighters — skip the role question.
    if (invitedFighter) { setForm(p => ({ ...p, accountType: 'fighter' })); return goNext('goal') }
    goNext('role')
  }

  const submitRole = () => {
    if (!form.accountType) return setError('Please select your role.')
    // Sponsors skip the fighter/manager questionnaire — minimal signup, then
    // they complete their company profile at /sponsor/onboard.
    if (form.accountType === 'sponsor') return submitFinal()
    goNext('goal')
  }

  const submitGoal = () => {
    if (!form.goal) return setError('Please select a goal.')
    goNext('problems')
  }

  const submitProblems = () => {
    // Q3 is optional — user may leave blank and continue.
    goNext('pipeline')
  }

  const submitPipeline = () => {
    // Q4 (endGoal) and Q5 (upcomingEvent) are optional — user may skip.
    if (form.accountType === 'fighter') submitFinal()
    else goNext('team')
  }

  const submitTeam = () => {
    if (!form.teamName.trim()) return setError('Please enter your team or organization name.')
    if (!form.subdomain)       return setError('Please enter a subdomain.')
    if (subStatus === 'taken') return setError('That subdomain is already taken.')
    if (subStatus === 'invalid') return setError('Subdomain must be 3–32 lowercase letters, numbers, or hyphens.')
    submitFinal()
  }

  const submitFinal = async () => {
    setLoading(true)
    setError('')
    const payload: RegisterData = {
      name:        form.name.trim(),
      email:       form.email.trim(),
      password:    form.password,
      accountType: form.accountType as RegisterData['accountType'],
      teamName:    form.teamName || undefined,
      subdomain:   form.subdomain || undefined,
      onboarding: {
        q1: form.accountType,
        q2: form.goal,
        q3: form.commonProblem,
        q4: form.endGoal,
        q5: form.upcomingEvent,
      },
    }
    const result = await register(payload)
    if (!result.ok) {
      setLoading(false)
      // Email already registered — show the "may not be verified, resend?" path.
      if (result.code === 'exists') { setError(''); setExistingAccount(true); return }
      // Account created but the verification email did not send — recoverable.
      if (result.emailFailed) { setError(result.error ?? ''); setEmailFailed(true); return }
      return setError(result.error ?? 'Registration failed.')
    }

    // Auto-confirm mode (dev only): no email step — log the user straight in.
    if (result.autoConfirmed) {
      const loginResult = await login(form.email.trim(), form.password)
      setLoading(false)
      if (loginResult.ok) return            // effect handles dashboard redirect
      // Account exists but auto-login hiccuped — send them to sign in manually.
      return navigate('/login', { replace: true })
    }

    // The client signUp already sent the confirmation email via Supabase's SMTP —
    // do NOT resend here (that would double-send / hit rate limits). Only now,
    // after a confirmed-successful send, do we show the inbox screen.
    setLoading(false)
    setStep('done')
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />

      {/* Atmospheric background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position:'absolute', left:'-5%', top:'10%', width:'45%', height:'80%',
          background:'radial-gradient(ellipse at 20% 40%, rgba(139,0,0,0.10) 0%, transparent 60%)',
        }} />
        <div style={{
          position:'absolute', right:'0', bottom:'0', width:'50%', height:'60%',
          background:'radial-gradient(ellipse at 80% 80%, rgba(60,0,0,0.08) 0%, transparent 60%)',
        }} />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-24 relative z-10">
        <div className="w-full max-w-[480px]">

          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="no-underline font-display text-off-white uppercase tracking-widest" style={{ fontSize: 22 }}>
              Eleventh Round
            </Link>
            <p className="font-condensed text-[11px] tracking-[0.3em] uppercase text-gray-3 mt-2">
              Create Your Account
            </p>
          </div>

          {/* ── Invite-aware screen (pending manager invite for this email) ── */}
          {showInviteScreen && (
            <InviteCard
              invite={invite!}
              email={form.email}
              onCreateAccount={() => {
                setForm(p => ({ ...p, accountType: 'fighter' }))
                setInvitedFighter(true)
                setInviteDismissed(true)
                setStep('account')
              }}
            />
          )}

          {/* ── Existing-account prompt ── */}
          {existingAccount && !showInviteScreen && (
            <div className="bg-charcoal border border-charcoal-3 p-8 relative overflow-hidden text-center"
                 style={{ borderLeft: '2px solid #8b0000' }}>
              <div className="relative z-10">
                <div className="sec-label mb-2 justify-center">Account Exists</div>
                <h2 className="font-display text-off-white uppercase mb-4"
                    style={{ fontSize:'clamp(28px,3.5vw,42px)', lineHeight:0.92 }}>
                  Already Registered
                </h2>
                <p className="font-narrow text-gray-1 leading-relaxed mb-6" style={{ fontSize:14, maxWidth:360, margin:'0 auto 24px' }}>
                  This account already exists but may not be verified. Want us to resend the
                  verification email to <strong className="text-off-white">{form.email}</strong>?
                </p>
                <ResendVerification email={form.email.trim()} cooldownSeconds={60} className="mb-5" />
                <p className="font-condensed text-[10px] text-gray-3 text-center">
                  Already verified?{' '}
                  <Link to="/login" className="text-blood-glow hover:text-off-white transition-colors no-underline">Sign In</Link>
                </p>
              </div>
            </div>
          )}

          {/* ── Email-send failure (account created, email not sent) ── */}
          {emailFailed && (
            <div className="bg-charcoal border border-charcoal-3 p-8 relative overflow-hidden text-center"
                 style={{ borderLeft: '2px solid #8b0000' }}>
              <div className="relative z-10">
                <div className="sec-label mb-2 justify-center">Action Needed</div>
                <h2 className="font-display text-off-white uppercase mb-4"
                    style={{ fontSize:'clamp(26px,3.4vw,40px)', lineHeight:0.95 }}>
                  Couldn't Send Verification Email
                </h2>
                <p className="font-narrow text-gray-1 leading-relaxed mb-6" style={{ fontSize:14, maxWidth:380, margin:'0 auto 20px' }}>
                  Your account was created, but we could not send the verification email to{' '}
                  <strong className="text-off-white">{form.email}</strong>. Try resending it below.
                </p>
                {error && <p className="font-condensed text-[11px] text-blood-glow mb-4">{error}</p>}
                <ResendVerification email={form.email.trim()} cooldownSeconds={60} className="mb-4" />
                <div className="flex flex-col gap-2 items-center">
                  <button type="button" onClick={() => { setEmailFailed(false); submitFinal() }}
                    className="btn-ghost text-[11px] py-2 px-4">Retry Registration</button>
                  <Link to="/login" className="font-condensed text-[10px] text-gray-3 hover:text-off-white transition-colors no-underline">
                    Back to Sign In
                  </Link>
                  <p className="font-condensed text-[10px] text-gray-3 mt-1">
                    Still stuck? Contact <span className="text-off-white">support@eleventh-rnd.com</span>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Card */}
          {step !== 'done' && !existingAccount && !showInviteScreen && !emailFailed && (
            <div className="bg-charcoal border border-charcoal-3 p-8 relative overflow-hidden"
                 style={{ borderLeft: '2px solid #8b0000' }}>
              <div className="absolute inset-0 pointer-events-none"
                   style={{ background:'radial-gradient(ellipse at 80% 10%, rgba(139,0,0,0.06) 0%, transparent 60%)' }} />

              <div className="relative z-10">
                <Progress current={visibleIdx} total={visibleSteps.length - 1} />

                {/* ── Step: account ── */}
                {step === 'account' && (
                  <>
                    <div className="sec-label mb-1">Step 1</div>
                    <h2 className="font-display text-off-white uppercase mb-6"
                        style={{ fontSize:'clamp(30px,3.5vw,44px)', lineHeight:0.92 }}>
                      Your Account
                    </h2>
                    <div className="space-y-4">
                      <Field label="Full Name"     value={form.name}  onChange={set('name')}  placeholder="Alex Torres" autoFocus />
                      <Field label="Email Address" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />

                      {/* Password with eye toggle + live rules */}
                      <div>
                        <Field
                          label="Password"
                          value={form.password}
                          onChange={set('password')}
                          placeholder="Min. 8 characters"
                          showEye
                          eyeVisible={showPw}
                          onToggleEye={() => setShowPw(v => !v)}
                        />
                        {form.password && (
                          <div className="mt-2 space-y-1">
                            {getPasswordRules(form.password).map(r => (
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

                      <div>
                        <Field
                          label="Confirm Password"
                          value={form.confirm}
                          onChange={set('confirm')}
                          placeholder="••••••••"
                          showEye
                          eyeVisible={showConf}
                          onToggleEye={() => setShowConf(v => !v)}
                        />
                        {form.confirm && form.confirm !== form.password && (
                          <p className="font-condensed text-[10px] text-blood-glow mt-1.5">Passwords do not match.</p>
                        )}
                        {form.confirm && form.confirm === form.password && validatePassword(form.password) && (
                          <p className="font-condensed text-[10px] mt-1.5" style={{ color: '#00c060' }}>✓ Passwords match</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* ── Step: role (Q1) ── */}
                {step === 'role' && (
                  <>
                    <div className="sec-label mb-1">Step 2 · Q1</div>
                    <h2 className="font-display text-off-white uppercase mb-2"
                        style={{ fontSize:'clamp(28px,3.5vw,42px)', lineHeight:0.92 }}>
                      Who Are You?
                    </h2>
                    <p className="font-narrow text-gray-2 mb-6" style={{ fontSize:13 }}>
                      Are you a fighter, management team, or promotion?
                    </p>
                    <div className="space-y-3">
                      {[
                        { value:'fighter',    label:'Fighter',          desc:'I compete and want to build my career.' },
                        { value:'management', label:'Management Team',  desc:'I manage or support fighters and need better systems.' },
                        { value:'promotion',  label:'Promotion',        desc:'I run events and want to raise professionalism standards.' },
                        { value:'sponsor',    label:'Sponsor / Brand',  desc:'I represent a brand and want to sponsor fighters.' },
                      ].map(o => (
                        <OptionCard key={o.value} label={o.label} desc={o.desc}
                          selected={form.accountType === o.value}
                          onClick={() => setForm(p => ({ ...p, accountType: o.value as FormState['accountType'] }))} />
                      ))}
                    </div>
                  </>
                )}

                {/* ── Step: goal (Q2) ── */}
                {step === 'goal' && (
                  <>
                    <div className="sec-label mb-1">Step 3 · Q2</div>
                    <h2 className="font-display text-off-white uppercase mb-2"
                        style={{ fontSize:'clamp(28px,3.5vw,42px)', lineHeight:0.92 }}>
                      Your Primary Goal
                    </h2>
                    <p className="font-narrow text-gray-2 mb-6" style={{ fontSize:13 }}>
                      What outcome matters most to you on The Eleventh Round?
                    </p>
                    <div className="space-y-3">
                      {GOAL_OPTIONS.map(o => (
                        <OptionCard key={o.value} label={o.label} desc={o.desc}
                          selected={form.goal === o.value}
                          onClick={() => setForm(p => ({ ...p, goal: o.value }))} />
                      ))}
                    </div>
                  </>
                )}

                {/* ── Step: problems (Q3) ── */}
                {step === 'problems' && (
                  <>
                    <div className="sec-label mb-1">Step 4 · Q3</div>
                    <h2 className="font-display text-off-white uppercase mb-2"
                        style={{ fontSize:'clamp(28px,3.5vw,42px)', lineHeight:0.92 }}>
                      Common Problems
                    </h2>
                    <p className="font-narrow text-gray-2 mb-6" style={{ fontSize:13 }}>
                      What is the most common problem on your roster — or in your own camp?{' '}
                      <span className="text-gray-3">(Optional — you can skip this.)</span>
                    </p>
                    <TextArea
                      label="Describe the problem (optional)"
                      value={form.commonProblem}
                      onChange={set('commonProblem')}
                      placeholder="e.g. Fighters miss media obligations, no structured onboarding… or leave blank to skip."
                      rows={4}
                    />
                  </>
                )}

                {/* ── Step: pipeline (Q4 + Q5) ── */}
                {step === 'pipeline' && (
                  <>
                    <div className="sec-label mb-1">Step 5 · Q4 &amp; Q5</div>
                    <h2 className="font-display text-off-white uppercase mb-2"
                        style={{ fontSize:'clamp(28px,3.5vw,42px)', lineHeight:0.92 }}>
                      The Pipeline
                    </h2>
                    <p className="font-narrow text-gray-3 mb-4" style={{ fontSize:12 }}>
                      Both questions below are optional — you can skip and continue.
                    </p>
                    <div className="space-y-5">
                      <TextArea
                        label="Q4 — What is your end goal with The Eleventh Round's Pipeline? (optional)"
                        value={form.endGoal}
                        onChange={set('endGoal')}
                        placeholder="e.g. Get my fighters sponsor-ready within 6 months… or leave blank to skip."
                        rows={4}
                      />
                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-3">
                          Q5 — Are you (or your team) preparing for an upcoming event? <span className="normal-case text-gray-3 font-normal">(optional)</span>
                        </label>
                        <div className="flex gap-3">
                          {['yes', 'no'].map(v => (
                            <button key={v} type="button"
                              onClick={() => setForm(p => ({
                                ...p,
                                upcomingEvent: p.upcomingEvent === v ? '' : v as 'yes'|'no',
                              }))}
                              className="flex-1 py-3 border font-condensed font-bold uppercase tracking-[0.2em] text-[12px] transition-all cursor-pointer"
                              style={{
                                borderColor: form.upcomingEvent === v ? '#8b0000' : '#222226',
                                background:  form.upcomingEvent === v ? 'rgba(139,0,0,0.12)' : '#141416',
                                color:       form.upcomingEvent === v ? '#f0ece4' : '#7a7672',
                              }}>
                              {v === 'yes' ? 'Yes' : 'No'}
                            </button>
                          ))}
                        </div>
                        <p className="font-condensed text-[9px] text-gray-3 mt-1.5">Click again to deselect.</p>
                      </div>
                    </div>
                  </>
                )}

                {/* ── Step: team ── */}
                {step === 'team' && (
                  <>
                    <div className="sec-label mb-1">Step 6</div>
                    <h2 className="font-display text-off-white uppercase mb-2"
                        style={{ fontSize:'clamp(28px,3.5vw,42px)', lineHeight:0.92 }}>
                      Your Team
                    </h2>
                    <p className="font-narrow text-gray-2 mb-6" style={{ fontSize:13 }}>
                      Teams get their own subdomain on The Eleventh Round platform.
                    </p>
                    <div className="space-y-4">
                      <Field label="Team / Organization Name" value={form.teamName}
                        onChange={set('teamName')} placeholder="e.g. Iron Camp Management" autoFocus />

                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
                          Subdomain
                        </label>
                        <div className="flex items-center border bg-charcoal-2"
                             style={{ borderColor: form.subdomain ? (subStatus === 'ok' ? '#2a5c2a' : subStatus === 'taken' || subStatus === 'invalid' ? '#8b0000' : '#222226') : '#222226' }}>
                          <input
                            type="text"
                            value={form.subdomain}
                            onChange={e => setForm(p => ({ ...p, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                            placeholder="iron-camp"
                            className="flex-1 bg-transparent text-off-white font-body text-[14px] px-4 py-3 outline-none placeholder:text-gray-3"
                          />
                          <span className="font-condensed text-[11px] text-gray-3 px-3 flex-shrink-0 select-none">
                            .eleventh-rnd.com
                          </span>
                        </div>
                        {/* Status indicator */}
                        {form.subdomain && (
                          <p className="font-condensed text-[10px] mt-1.5 tracking-wide"
                             style={{ color: subStatus === 'ok' ? '#4a8c4a' : subStatus === 'taken' || subStatus === 'invalid' ? '#C41E3A' : '#4a4846' }}>
                            {subStatus === 'checking' && '↻ Checking availability…'}
                            {subStatus === 'ok'      && '✓ Available'}
                            {subStatus === 'taken'   && '✕ Already taken — try another'}
                            {subStatus === 'invalid' && '✕ 3–32 lowercase letters, numbers, or hyphens only'}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* ── Error ── */}
                {error && (
                  <div className="mt-5 font-condensed text-[11px] tracking-wide text-blood-glow
                                  bg-blood/10 border border-blood/25 px-4 py-2.5">
                    {error}
                  </div>
                )}

                {/* ── Actions ── */}
                <div className="flex gap-3 mt-7">
                  {step !== 'account' && (
                    <button type="button" onClick={() => {
                      const backMap: Partial<Record<Step,Step>> = {
                        role:'account', goal:'role', problems:'goal',
                        pipeline:'problems', team:'pipeline',
                      }
                      goBack(backMap[step]!)
                    }} className="btn-ghost flex-shrink-0">← Back</button>
                  )}

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      if (step === 'account')   return submitAccount()
                      if (step === 'role')      return submitRole()
                      if (step === 'goal')      return submitGoal()
                      if (step === 'problems')  return submitProblems()
                      if (step === 'pipeline')  return submitPipeline()
                      if (step === 'team')      return submitTeam()
                    }}
                    className="btn-primary flex-1 text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ display:'flex', alignItems:'center', justifyContent:'center' }}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 border border-off-white/40 border-t-off-white rounded-full animate-spin" />
                        Creating account…
                      </span>
                    ) : step === 'pipeline' && form.accountType === 'fighter' ? 'Create Account'
                      : step === 'team'     ? 'Create Account'
                      : 'Continue →'}
                  </button>
                </div>

                <p className="font-condensed text-[10px] text-gray-3 text-center mt-5">
                  Already have an account?{' '}
                  <Link to="/login" className="text-blood-glow hover:text-off-white transition-colors no-underline">Sign In</Link>
                </p>

              </div>
            </div>
          )}

          {/* ── Step: done ── */}
          {step === 'done' && (
            <div className="bg-charcoal border border-charcoal-3 p-10 relative overflow-hidden text-center"
                 style={{ borderLeft:'2px solid #8b0000' }}>
              <div className="absolute inset-0 pointer-events-none"
                   style={{ background:'radial-gradient(ellipse at 50% 0%, rgba(139,0,0,0.08) 0%, transparent 60%)' }} />
              <div className="relative z-10">
                {/* Red check mark */}
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

                <div className="sec-label mb-2 justify-center">Account Created</div>
                <h2 className="font-display text-off-white uppercase mb-4"
                    style={{ fontSize:'clamp(32px,4vw,52px)', lineHeight:0.92 }}>
                  Check Your Inbox
                </h2>
                <p className="font-narrow text-gray-1 leading-relaxed mb-8" style={{ fontSize:14, maxWidth:360, margin:'0 auto 28px' }}>
                  We've sent a verification link to{' '}
                  <strong className="text-off-white">{form.email}</strong>.
                  Click it to activate your account and access your dashboard.
                </p>
                <p className="font-condensed text-[11px] text-gray-3 tracking-wide mb-5">
                  Didn't receive it? Check your spam folder, or resend below.
                </p>

                {/* Resend — we already sent one on registration, so start cooled-down. */}
                <ResendVerification
                  email={form.email.trim()}
                  initialSent
                  cooldownSeconds={60}
                  className="mb-6 text-left"
                />

                <Link to="/login" className="btn-primary inline-block">
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
