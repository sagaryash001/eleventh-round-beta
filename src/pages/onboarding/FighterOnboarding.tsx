import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import Navbar from '../../components/Navbar'

// ── Reference data ────────────────────────────────────────────────────────────
const SPORTS = [
  { value: 'mma',        label: 'MMA' },
  { value: 'boxing',     label: 'Boxing' },
  { value: 'bjj',        label: 'BJJ' },
  { value: 'muay_thai',  label: 'Muay Thai' },
  { value: 'wrestling',  label: 'Wrestling' },
  { value: 'other',      label: 'Other' },
]

const WEIGHT_CLASSES = [
  'Strawweight', 'Flyweight', 'Bantamweight', 'Featherweight',
  'Lightweight', 'Welterweight', 'Middleweight', 'Light Heavyweight', 'Heavyweight',
  "Women's Strawweight", "Women's Flyweight", "Women's Bantamweight", "Women's Featherweight",
  'Other / Custom',
]

// ── Shared form primitives ────────────────────────────────────────────────────
function Field({
  label, type = 'text', value, onChange, placeholder, hint, required = false, autoFocus,
}: {
  label: string; type?: string; value: string | number; onChange: (v: string) => void
  placeholder?: string; hint?: string; required?: boolean; autoFocus?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
        {label}{required && <span className="text-blood-glow ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3
                   outline-none transition-all duration-200 placeholder:text-gray-3"
        style={{ borderColor: focused ? '#8b0000' : '#222226' }}
      />
      {hint && <p className="font-condensed text-[10px] text-gray-3 mt-1.5 tracking-wide">{hint}</p>}
    </div>
  )
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="font-condensed font-semibold uppercase text-[11px] tracking-[0.1em] px-3.5 py-2 border cursor-pointer transition-all"
      style={{
        borderColor: selected ? '#8b0000' : '#222226',
        background:  selected ? 'rgba(139,0,0,0.12)' : '#141416',
        color:       selected ? '#f0ece4' : '#7a7672',
      }}>
      {label}
    </button>
  )
}

function OptionCard({ label, desc, selected, onClick }: {
  label: string; desc?: string; selected: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick}
      className="w-full text-left border px-5 py-4 transition-all cursor-pointer"
      style={{
        borderColor: selected ? '#8b0000' : '#222226',
        borderLeft:  `3px solid ${selected ? '#8b0000' : 'transparent'}`,
        background:  selected ? 'rgba(139,0,0,0.08)' : '#141416',
      }}>
      <div className="font-condensed font-bold text-[13px] tracking-wide"
        style={{ color: selected ? '#f0ece4' : '#7a7672' }}>{label}</div>
      {desc && <div className="font-condensed text-[11px] text-gray-3 mt-1 leading-relaxed">{desc}</div>}
    </button>
  )
}

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 20 : 6, height: 4, borderRadius: 2,
          background: i < current ? '#8b0000' : i === current ? '#C41E3A' : '#222226',
          transition: 'all 0.3s',
        }} />
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
type Step = 'profile' | 'base' | 'social' | 'goals' | 'done'
const STEPS: Step[] = ['profile', 'base', 'social', 'goals', 'done']

interface Form {
  full_name: string; nickname: string; sport: string; level: string
  weight_class: string; custom_weight: string
  record_wins: string; record_losses: string; record_draws: string
  base_city: string; gym_name: string
  manager_status: string; manager_name: string; manager_email: string
  instagram_handle: string; instagram_followers: string
  tiktok_handle: string; youtube_handle: string; bio: string
  has_upcoming_event: boolean; event_date: string; event_name: string; goal: string
}

export default function FighterOnboarding() {
  const { user, refreshUser, logout } = useAuth()
  const navigate = useNavigate()

  const signOut = async () => { await logout(); navigate('/login', { replace: true }) }
  const [step, setStep] = useState<Step>('profile')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<Form>({
    full_name:          user?.name ?? '',
    nickname:           '', sport: '', level: '',
    weight_class:       '', custom_weight: '',
    record_wins:        '0', record_losses: '0', record_draws: '0',
    base_city:          '', gym_name: '',
    manager_status:     '', manager_name: '', manager_email: '',
    instagram_handle:   '', instagram_followers: '0',
    tiktok_handle:      '', youtube_handle: '', bio: '',
    has_upcoming_event: false, event_date: '', event_name: '', goal: '',
  })

  const set = (k: keyof Form) => (v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }))

  const idx = STEPS.indexOf(step)

  const next = (to: Step) => { setError(''); setStep(to) }
  const back = (to: Step) => { setError(''); setStep(to) }

  // ── Validation per step ────────────────────────────────────────
  const validateProfile = () => {
    if (!form.full_name.trim()) return 'Full name is required.'
    if (!form.sport)            return 'Select your primary sport.'
    if (!form.level)            return 'Select your competition level.'
    if (!form.weight_class)     return 'Select your weight class.'
    return null
  }
  const validateBase = () => null   // optional fields
  const validateSocial = () => null // optional fields

  const submit = async () => {
    setSaving(true); setError('')
    try {
      const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null
      const res = await apiFetch('/api/onboarding/fighter', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          full_name:           form.full_name.trim(),
          nickname:            form.nickname.trim()  || null,
          sport:               form.sport,
          level:               form.level,
          weight_class:        form.weight_class === 'Other / Custom' ? form.custom_weight.trim() : form.weight_class,
          record_wins:         Number(form.record_wins)   || 0,
          record_losses:       Number(form.record_losses) || 0,
          record_draws:        Number(form.record_draws)  || 0,
          base_city:           form.base_city.trim()    || null,
          gym_name:            form.gym_name.trim()     || null,
          bio:                 form.bio.trim()          || null,
          manager_status:      form.manager_status      || 'self_manages',
          manager_name:        form.manager_name.trim() || null,
          manager_email:       form.manager_email.trim()|| null,
          instagram_handle:    form.instagram_handle.trim().replace(/^@/, '') || null,
          instagram_followers: Number(form.instagram_followers) || 0,
          tiktok_handle:       form.tiktok_handle.trim().replace(/^@/, '') || null,
          youtube_handle:      form.youtube_handle.trim().replace(/^@/, '') || null,
          has_upcoming_event:  form.has_upcoming_event,
          event_date:          form.event_date || null,
          event_name:          form.event_name.trim() || null,
          goal:                form.goal.trim()       || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Setup failed. Try again.'); setSaving(false); return }
      await refreshUser()
      setStep('done')
      setTimeout(() => navigate('/dashboard/fighter', { replace: true }), 1800)
    } catch {
      setError('Could not reach the server. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position:'absolute', right:'-5%', top:'5%', width:'50%', height:'80%',
          background:'radial-gradient(ellipse at 80% 30%, rgba(139,0,0,0.10) 0%, transparent 65%)',
        }} />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-16 relative z-10">
        <div className="w-full max-w-[520px]">

          <div className="text-center mb-8">
            <Link to="/" className="no-underline font-display text-off-white uppercase tracking-widest" style={{ fontSize: 20 }}>
              Eleventh Round
            </Link>
            <p className="font-condensed text-[11px] tracking-[0.3em] uppercase text-gray-3 mt-2">
              Fighter Setup — Step {idx + 1} of {STEPS.length - 1}
            </p>
            <button onClick={signOut}
              className="font-condensed text-[10px] tracking-[0.2em] uppercase text-gray-3 hover:text-blood-glow transition-colors mt-3 bg-transparent border-0 cursor-pointer">
              Not you? Sign out
            </button>
          </div>

          {step !== 'done' && (
            <div className="bg-charcoal border border-charcoal-3 p-8 relative overflow-hidden"
                 style={{ borderLeft: '2px solid #8b0000' }}>
              <div className="absolute inset-0 pointer-events-none"
                   style={{ background:'radial-gradient(ellipse at 80% 10%, rgba(139,0,0,0.06) 0%, transparent 60%)' }} />

              <div className="relative z-10">
                <Progress current={idx} total={STEPS.length - 1} />

                {/* ── Step: profile ── */}
                {step === 'profile' && (
                  <>
                    <div className="sec-label mb-1">Step 1</div>
                    <h2 className="font-display text-off-white uppercase mb-6"
                        style={{ fontSize: 'clamp(28px,3.5vw,40px)', lineHeight: 0.92 }}>
                      About You
                    </h2>
                    <div className="space-y-4">
                      <Field label="Full Name" value={form.full_name} onChange={set('full_name')}
                        placeholder="Alex Torres" required autoFocus />
                      <Field label="Fight Name / Nickname" value={form.nickname}
                        onChange={set('nickname')} placeholder="The Destroyer" hint="Optional" />

                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2.5">
                          Primary Sport <span className="text-blood-glow">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {SPORTS.map(s => (
                            <Chip key={s.value} label={s.label}
                              selected={form.sport === s.value}
                              onClick={() => set('sport')(s.value)} />
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2.5">
                          Level <span className="text-blood-glow">*</span>
                        </label>
                        <div className="flex gap-3">
                          {[{v:'amateur', l:'Amateur'},{v:'pro', l:'Professional'}].map(o => (
                            <button key={o.v} type="button" onClick={() => set('level')(o.v)}
                              className="flex-1 py-3 border font-condensed font-bold uppercase tracking-[0.2em] text-[12px] transition-all cursor-pointer"
                              style={{
                                borderColor: form.level === o.v ? '#8b0000' : '#222226',
                                background:  form.level === o.v ? 'rgba(139,0,0,0.12)' : '#141416',
                                color:       form.level === o.v ? '#f0ece4' : '#7a7672',
                              }}>{o.l}</button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2.5">
                          Weight Class <span className="text-blood-glow">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {WEIGHT_CLASSES.map(w => (
                            <Chip key={w} label={w}
                              selected={form.weight_class === w}
                              onClick={() => set('weight_class')(w)} />
                          ))}
                        </div>
                        {form.weight_class === 'Other / Custom' && (
                          <div className="mt-3">
                            <Field label="Custom weight class" value={form.custom_weight}
                              onChange={set('custom_weight')} placeholder="e.g. Super Featherweight" />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2.5">
                          Fight Record
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          <Field label="Wins"   type="number" value={form.record_wins}
                            onChange={set('record_wins')} placeholder="0" />
                          <Field label="Losses" type="number" value={form.record_losses}
                            onChange={set('record_losses')} placeholder="0" />
                          <Field label="Draws"  type="number" value={form.record_draws}
                            onChange={set('record_draws')} placeholder="0" />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ── Step: base ── */}
                {step === 'base' && (
                  <>
                    <div className="sec-label mb-1">Step 2</div>
                    <h2 className="font-display text-off-white uppercase mb-6"
                        style={{ fontSize: 'clamp(28px,3.5vw,40px)', lineHeight: 0.92 }}>
                      Your Base
                    </h2>
                    <div className="space-y-4">
                      <Field label="City / Location" value={form.base_city}
                        onChange={set('base_city')} placeholder="Miami, FL" autoFocus />
                      <Field label="Gym / Team Name" value={form.gym_name}
                        onChange={set('gym_name')} placeholder="American Top Team" />

                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2.5">
                          Manager Status
                        </label>
                        <div className="space-y-2">
                          {[
                            { v:'has_manager',  l:'I have a manager', d:'My manager is already in the system or I will invite them.' },
                            { v:'needs_manager',l:'I need a manager', d:'I\'m looking for management help.' },
                            { v:'self_manages', l:'I self-manage',    d:'I handle my own career independently.' },
                          ].map(o => (
                            <OptionCard key={o.v} label={o.l} desc={o.d}
                              selected={form.manager_status === o.v}
                              onClick={() => set('manager_status')(o.v)} />
                          ))}
                        </div>
                      </div>

                      {form.manager_status === 'has_manager' && (
                        <div className="space-y-3 pl-4 border-l-2" style={{ borderColor: '#8b0000' }}>
                          <Field label="Manager / Team Name" value={form.manager_name}
                            onChange={set('manager_name')} placeholder="Ray Callahan" />
                          <Field label="Manager Email (optional)" type="email" value={form.manager_email}
                            onChange={set('manager_email')} placeholder="manager@example.com"
                            hint="If their account exists, we will link you automatically." />
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── Step: social ── */}
                {step === 'social' && (
                  <>
                    <div className="sec-label mb-1">Step 3</div>
                    <h2 className="font-display text-off-white uppercase mb-6"
                        style={{ fontSize: 'clamp(28px,3.5vw,40px)', lineHeight: 0.92 }}>
                      Your Reach
                    </h2>
                    <p className="font-narrow text-gray-2 mb-5 -mt-4" style={{ fontSize: 13 }}>
                      Social media data helps sponsors find and evaluate you.
                    </p>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Instagram Handle" value={form.instagram_handle}
                          onChange={set('instagram_handle')} placeholder="@username" autoFocus />
                        <Field label="Followers" type="number" value={form.instagram_followers}
                          onChange={set('instagram_followers')} placeholder="0" />
                      </div>
                      <Field label="TikTok Handle (optional)" value={form.tiktok_handle}
                        onChange={set('tiktok_handle')} placeholder="@username" />
                      <Field label="YouTube Handle (optional)" value={form.youtube_handle}
                        onChange={set('youtube_handle')} placeholder="@channel" />
                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
                          Bio / Headline (optional)
                        </label>
                        <textarea
                          value={form.bio}
                          onChange={e => set('bio')(e.target.value)}
                          rows={3}
                          placeholder="One-sentence description of who you are as a fighter…"
                          className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3
                                     outline-none transition-all duration-200 placeholder:text-gray-3 resize-none"
                          style={{ borderColor: '#222226' }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* ── Step: goals ── */}
                {step === 'goals' && (
                  <>
                    <div className="sec-label mb-1">Step 4</div>
                    <h2 className="font-display text-off-white uppercase mb-6"
                        style={{ fontSize: 'clamp(28px,3.5vw,40px)', lineHeight: 0.92 }}>
                      Your Goals
                    </h2>
                    <div className="space-y-5">
                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2.5">
                          Do you have an upcoming fight or event?
                        </label>
                        <div className="flex gap-3">
                          {[{v:true,l:'Yes — I have a fight scheduled'},{v:false,l:'No upcoming events'}].map(o => (
                            <button key={String(o.v)} type="button"
                              onClick={() => set('has_upcoming_event')(o.v)}
                              className="flex-1 py-3 border font-condensed font-bold text-[11px] tracking-[0.1em] transition-all cursor-pointer"
                              style={{
                                borderColor: form.has_upcoming_event === o.v ? '#8b0000' : '#222226',
                                background:  form.has_upcoming_event === o.v ? 'rgba(139,0,0,0.12)' : '#141416',
                                color:       form.has_upcoming_event === o.v ? '#f0ece4' : '#7a7672',
                              }}>{o.l}</button>
                          ))}
                        </div>
                      </div>

                      {form.has_upcoming_event && (
                        <div className="space-y-3 pl-4 border-l-2" style={{ borderColor: '#8b0000' }}>
                          <Field label="Event Name" value={form.event_name}
                            onChange={set('event_name')} placeholder="UFC Fight Night" />
                          <Field label="Event Date" type="date" value={form.event_date}
                            onChange={set('event_date')} />
                        </div>
                      )}

                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
                          What is your goal with The Eleventh Round? (optional)
                        </label>
                        <textarea
                          value={form.goal}
                          onChange={e => set('goal')(e.target.value)}
                          rows={3}
                          placeholder="e.g. Land my first sponsor within 6 months, build my brand, connect with management…"
                          className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3
                                     outline-none transition-all placeholder:text-gray-3 resize-none"
                          style={{ borderColor: '#222226' }}
                        />
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
                  {step !== 'profile' && (
                    <button type="button" onClick={() => {
                      const backMap: Partial<Record<Step,Step>> = {
                        base:'profile', social:'base', goals:'social',
                      }
                      back(backMap[step]!)
                    }} className="btn-ghost flex-shrink-0" disabled={saving}>← Back</button>
                  )}

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setError('')
                      if (step === 'profile') {
                        const e = validateProfile(); if (e) { setError(e); return }
                        next('base')
                      } else if (step === 'base') {
                        const e = validateBase(); if (e) { setError(e); return }
                        next('social')
                      } else if (step === 'social') {
                        const e = validateSocial(); if (e) { setError(e); return }
                        next('goals')
                      } else if (step === 'goals') {
                        submit()
                      }
                    }}
                    className="btn-primary flex-1 text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 border border-off-white/40 border-t-off-white rounded-full animate-spin" />
                        Saving…
                      </span>
                    ) : step === 'goals' ? 'Complete Setup' : 'Continue →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === 'done' && (
            <div className="bg-charcoal border border-charcoal-3 p-10 text-center relative overflow-hidden"
                 style={{ borderLeft: '2px solid #8b0000' }}>
              <div className="relative z-10">
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
                <div className="sec-label mb-2 justify-center">Profile Created</div>
                <h2 className="font-display text-off-white uppercase mb-4"
                    style={{ fontSize: 'clamp(30px,4vw,48px)', lineHeight: 0.92 }}>
                  You're In The Round.
                </h2>
                <p className="font-narrow text-gray-2 mb-6" style={{ fontSize: 13 }}>
                  Your fighter profile and readiness score have been created. Taking you to your dashboard…
                </p>
                <div className="w-full h-0.5 bg-charcoal-3 overflow-hidden">
                  <div className="h-full bg-blood-glow"
                       style={{ animation: 'verifyProgress 1.8s linear forwards' }} />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      <style>{`@keyframes verifyProgress { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  )
}
