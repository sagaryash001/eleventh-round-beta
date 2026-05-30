import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, RegisterData } from '../hooks/useAuth'
import { apiFetch } from '../lib/api'
import Navbar from '../components/Navbar'

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
}: {
  label: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string; hint?: string; autoFocus?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3
                   outline-none transition-all duration-200 placeholder:text-gray-3"
        style={{ borderColor: focused ? '#8b0000' : '#222226' }}
      />
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
  const [step, setStep]    = useState<Step>('account')
  const [error, setError]  = useState('')
  const [loading, setLoading] = useState(false)
  const [subStatus, setSubStatus] = useState<'idle'|'checking'|'ok'|'taken'|'invalid'>('idle')
  const subTimer = useRef<ReturnType<typeof setTimeout>|null>(null)

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

  // Redirect if already logged in. Sponsors go to onboarding (the onboard page
  // itself bounces already-onboarded sponsors to their dashboard).
  useEffect(() => {
    if (user) navigate(
      user.role === 'fighter' ? '/dashboard/fighter' :
      user.role === 'manager' ? '/dashboard/manager' :
      user.role === 'sponsor' ? '/sponsor/onboard'   :
      '/dashboard/admin', { replace: true }
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
    if (!form.name.trim())        return setError('Please enter your name.')
    if (!form.email.trim())       return setError('Please enter your email.')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    if (form.password !== form.confirm) return setError('Passwords do not match.')
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
    if (!form.commonProblem.trim()) return setError('Please describe the most common problem.')
    goNext('pipeline')
  }

  const submitPipeline = () => {
    if (!form.endGoal.trim())   return setError('Please describe your end goal.')
    if (!form.upcomingEvent)    return setError('Please answer the upcoming event question.')
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
    if (!result.ok) { setLoading(false); return setError(result.error ?? 'Registration failed.') }

    // Auto-confirm mode: no email step — log the user straight in.
    // The redirect-if-logged-in effect will take them to their dashboard.
    if (result.autoConfirmed) {
      const loginResult = await login(form.email.trim(), form.password)
      setLoading(false)
      if (loginResult.ok) return            // effect handles dashboard redirect
      // Account exists but auto-login hiccuped — send them to sign in manually.
      return navigate('/login', { replace: true })
    }

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

          {/* Card */}
          {step !== 'done' && (
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
                      <Field label="Full Name"    value={form.name}     onChange={set('name')}     placeholder="Alex Torres" autoFocus />
                      <Field label="Email Address" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
                      <Field label="Password"     type="password" value={form.password} onChange={set('password')} placeholder="Min. 8 characters" hint="At least 8 characters." />
                      <Field label="Confirm Password" type="password" value={form.confirm} onChange={set('confirm')} placeholder="••••••••" />
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
                      What is the most common problem on your roster — or in your own camp?
                    </p>
                    <TextArea
                      label="Describe the problem"
                      value={form.commonProblem}
                      onChange={set('commonProblem')}
                      placeholder="e.g. Fighters miss media obligations, no structured onboarding, unprofessional conduct at events…"
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
                    <div className="space-y-5">
                      <TextArea
                        label="Q4 — What is your end goal with The Eleventh Round's Pipeline?"
                        value={form.endGoal}
                        onChange={set('endGoal')}
                        placeholder="e.g. Get my fighters sponsor-ready within 6 months, build a sustainable management operation…"
                        rows={4}
                      />
                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-3">
                          Q5 — Are you (or your team) preparing for an upcoming event?
                        </label>
                        <div className="flex gap-3">
                          {['yes', 'no'].map(v => (
                            <button key={v} type="button"
                              onClick={() => setForm(p => ({ ...p, upcomingEvent: v as 'yes'|'no' }))}
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
                <p className="font-condensed text-[11px] text-gray-3 tracking-wide mb-6">
                  Didn't receive it? Check your spam folder.
                </p>
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
