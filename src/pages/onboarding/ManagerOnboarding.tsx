import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import Navbar from '../../components/Navbar'

const MANAGER_TYPES = [
  { value: 'agent',     label: 'Agent',        desc: 'Represent fighters and negotiate deals.' },
  { value: 'coach',     label: 'Coach',        desc: 'Train and develop fighters.' },
  { value: 'gym',       label: 'Gym Owner',    desc: 'Run a gym and manage affiliated athletes.' },
  { value: 'mentor',    label: 'Mentor',       desc: 'Mentor and advise fighters on career development.' },
  { value: 'team',      label: 'Team Manager', desc: 'Manage a team of fighters across events.' },
  { value: 'promotion', label: 'Promotion',    desc: 'Run events and manage fighter rosters.' },
]

function Field({
  label, type = 'text', value, onChange, placeholder, hint, required = false, autoFocus,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void
  placeholder?: string; hint?: string; required?: boolean; autoFocus?: boolean
}) {
  const [f, setF] = useState(false)
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
        {label}{required && <span className="text-blood-glow ml-1">*</span>}
      </label>
      <input type={type} value={value} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setF(true)} onBlur={() => setF(false)}
        placeholder={placeholder}
        className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3
                   outline-none transition-all placeholder:text-gray-3"
        style={{ borderColor: f ? '#8b0000' : '#222226' }} />
      {hint && <p className="font-condensed text-[10px] text-gray-3 mt-1.5 tracking-wide">{hint}</p>}
    </div>
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
      <div className="font-condensed font-bold text-[13px]" style={{ color: selected ? '#f0ece4' : '#7a7672' }}>
        {label}
      </div>
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

type Step = 'setup' | 'team' | 'done'
const STEPS: Step[] = ['setup', 'team', 'done']

export default function ManagerOnboarding() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('setup')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [slugStatus, setSlugStatus] = useState<'idle'|'checking'|'ok'|'taken'|'invalid'>('idle')
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState({
    manager_name:      user?.name ?? '',
    team_name:         user?.subdomain ? '' : '',
    manager_type:      '',
    location:          '',
    primary_sport:     '',
    fighter_count:     '0',
    website_or_social: '',
    team_slug:         '',
  })
  const set = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  // Auto-suggest slug from team name
  useEffect(() => {
    if (!form.team_name) return
    const slug = form.team_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setForm(p => ({ ...p, team_slug: slug }))
  }, [form.team_name])

  // Debounced slug check
  useEffect(() => {
    if (!form.team_slug) { setSlugStatus('idle'); return }
    if (!/^[a-z0-9-]{3,40}$/.test(form.team_slug)) { setSlugStatus('invalid'); return }
    if (slugTimer.current) clearTimeout(slugTimer.current)
    setSlugStatus('checking')
    slugTimer.current = setTimeout(async () => {
      try {
        const r = await apiFetch(`/api/auth/check-subdomain/${form.team_slug}`)
        const d = await r.json()
        setSlugStatus(d.available ? 'ok' : 'taken')
      } catch { setSlugStatus('idle') }
    }, 500)
  }, [form.team_slug])

  const idx = STEPS.indexOf(step)

  const submit = async () => {
    if (!form.team_name.trim())  { setError('Team or organization name is required.'); return }
    if (!form.manager_type)      { setError('Please select your role type.'); return }
    if (slugStatus === 'taken')  { setError('That team URL is already taken.'); return }
    if (slugStatus === 'invalid') { setError('Team URL must be 3–40 lowercase letters, numbers, or hyphens.'); return }

    setSaving(true); setError('')
    try {
      const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null
      const res = await apiFetch('/api/onboarding/manager', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          manager_name:      form.manager_name.trim() || user?.name || '',
          team_name:         form.team_name.trim(),
          manager_type:      form.manager_type,
          location:          form.location.trim()          || null,
          primary_sport:     form.primary_sport.trim()     || null,
          fighter_count:     Number(form.fighter_count)    || 0,
          website_or_social: form.website_or_social.trim() || null,
          team_slug:         form.team_slug.trim()         || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Setup failed.'); setSaving(false); return }
      await refreshUser()
      setStep('done')
      setTimeout(() => navigate('/dashboard/manager', { replace: true }), 1800)
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
          position:'absolute', left:'-5%', top:'5%', width:'45%', height:'80%',
          background:'radial-gradient(ellipse at 20% 40%, rgba(139,0,0,0.09) 0%, transparent 60%)',
        }} />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-16 relative z-10">
        <div className="w-full max-w-[520px]">

          <div className="text-center mb-8">
            <Link to="/" className="no-underline font-display text-off-white uppercase tracking-widest" style={{ fontSize: 20 }}>
              Eleventh Round
            </Link>
            <p className="font-condensed text-[11px] tracking-[0.3em] uppercase text-gray-3 mt-2">
              Manager / Team Setup
            </p>
          </div>

          {step !== 'done' && (
            <div className="bg-charcoal border border-charcoal-3 p-8 relative overflow-hidden"
                 style={{ borderLeft: '2px solid #8b0000' }}>
              <div className="absolute inset-0 pointer-events-none"
                   style={{ background:'radial-gradient(ellipse at 80% 10%, rgba(139,0,0,0.05) 0%, transparent 60%)' }} />
              <div className="relative z-10">
                <Progress current={idx} total={STEPS.length - 1} />

                {/* ── Step: setup ── */}
                {step === 'setup' && (
                  <>
                    <div className="sec-label mb-1">Step 1</div>
                    <h2 className="font-display text-off-white uppercase mb-6"
                        style={{ fontSize: 'clamp(28px,3.5vw,40px)', lineHeight: 0.92 }}>
                      Your Setup
                    </h2>
                    <div className="space-y-4">
                      <Field label="Your Name" value={form.manager_name} onChange={set('manager_name')}
                        placeholder="Ray Callahan" required autoFocus />
                      <Field label="Team / Organization Name" value={form.team_name}
                        onChange={set('team_name')} placeholder="Iron Camp Management" required />

                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2.5">
                          Your Role <span className="text-blood-glow">*</span>
                        </label>
                        <div className="space-y-2">
                          {MANAGER_TYPES.map(o => (
                            <OptionCard key={o.value} label={o.label} desc={o.desc}
                              selected={form.manager_type === o.value}
                              onClick={() => set('manager_type')(o.value)} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ── Step: team ── */}
                {step === 'team' && (
                  <>
                    <div className="sec-label mb-1">Step 2</div>
                    <h2 className="font-display text-off-white uppercase mb-6"
                        style={{ fontSize: 'clamp(28px,3.5vw,40px)', lineHeight: 0.92 }}>
                      Your Platform
                    </h2>
                    <div className="space-y-4">
                      <Field label="Location" value={form.location} onChange={set('location')}
                        placeholder="Las Vegas, NV" autoFocus />
                      <Field label="Primary Sport" value={form.primary_sport}
                        onChange={set('primary_sport')} placeholder="MMA, Boxing…" />
                      <Field label="Number of Fighters" type="number" value={form.fighter_count}
                        onChange={set('fighter_count')} placeholder="0"
                        hint="Approximate number of athletes you currently manage." />
                      <Field label="Website or Social Link" value={form.website_or_social}
                        onChange={set('website_or_social')} placeholder="https://ironcampmanagement.com" />

                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
                          Team URL (optional)
                        </label>
                        <div className="flex items-center border bg-charcoal-2"
                             style={{ borderColor: form.team_slug ? (
                               slugStatus === 'ok' ? '#2a5c2a' :
                               slugStatus === 'taken' || slugStatus === 'invalid' ? '#8b0000' : '#222226'
                             ) : '#222226' }}>
                          <input type="text" value={form.team_slug}
                            onChange={e => set('team_slug')(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            placeholder="iron-camp"
                            className="flex-1 bg-transparent text-off-white font-body text-[14px] px-4 py-3 outline-none placeholder:text-gray-3"
                          />
                          <span className="font-condensed text-[11px] text-gray-3 px-3 flex-shrink-0">
                            /team/
                          </span>
                        </div>
                        {form.team_slug && (
                          <p className="font-condensed text-[10px] mt-1.5 tracking-wide" style={{
                            color: slugStatus === 'ok' ? '#4a8c4a' :
                                   slugStatus === 'taken' || slugStatus === 'invalid' ? '#C41E3A' : '#4a4846'
                          }}>
                            {slugStatus === 'checking' && '↻ Checking…'}
                            {slugStatus === 'ok'       && '✓ Available'}
                            {slugStatus === 'taken'    && '✕ Already taken'}
                            {slugStatus === 'invalid'  && '✕ 3–40 lowercase letters, numbers, or hyphens'}
                          </p>
                        )}
                        <p className="font-condensed text-[10px] text-gray-3 mt-1.5">
                          Your team page will be at eleventh-rnd.com/team/{form.team_slug || 'your-slug'}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {error && (
                  <div className="mt-5 font-condensed text-[11px] text-blood-glow bg-blood/10 border border-blood/25 px-4 py-2.5">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 mt-7">
                  {step === 'team' && (
                    <button onClick={() => { setError(''); setStep('setup') }}
                      className="btn-ghost flex-shrink-0" disabled={saving}>← Back</button>
                  )}
                  <button type="button" disabled={saving}
                    onClick={() => {
                      setError('')
                      if (step === 'setup') {
                        if (!form.manager_type) { setError('Please select your role type.'); return }
                        setStep('team')
                      } else {
                        submit()
                      }
                    }}
                    className="btn-primary flex-1 text-center disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 border border-off-white/40 border-t-off-white rounded-full animate-spin" />
                        Saving…
                      </span>
                    ) : step === 'team' ? 'Complete Setup' : 'Continue →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="bg-charcoal border border-charcoal-3 p-10 text-center relative overflow-hidden"
                 style={{ borderLeft: '2px solid #8b0000' }}>
              <div className="relative z-10">
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'rgba(139,0,0,0.15)', border: '1.5px solid #8b0000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C41E3A"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="sec-label mb-2 justify-center">Setup Complete</div>
                <h2 className="font-display text-off-white uppercase mb-4"
                    style={{ fontSize: 'clamp(28px,4vw,44px)', lineHeight: 0.92 }}>
                  Ready To Manage.
                </h2>
                <p className="font-narrow text-gray-2 mb-6" style={{ fontSize: 13 }}>
                  Your management profile is active. Taking you to your dashboard…
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
