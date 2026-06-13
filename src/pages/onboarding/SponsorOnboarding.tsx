import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import Navbar from '../../components/Navbar'

const WEIGHT_CLASSES = [
  'Strawweight', 'Flyweight', 'Bantamweight', 'Featherweight',
  'Lightweight', 'Welterweight', 'Middleweight', 'Light Heavyweight', 'Heavyweight',
  "Women's Divisions",
]
const COMBAT_SPORTS = ['Striking', 'Grappling', 'MMA']
const GOALS = [
  { value: 'awareness',  label: 'Brand Awareness' },
  { value: 'conversion', label: 'Conversions / Sales' },
  { value: 'content',    label: 'Content Creation' },
  { value: 'hiring',     label: 'Recruiting / Hiring' },
  { value: 'merch',      label: 'Merch & Apparel' },
]
const SIZES = [
  { value: 'solo',       label: 'Solo / Founder' },
  { value: 'small',      label: 'Small (2–20)' },
  { value: 'mid',        label: 'Mid (21–200)' },
  { value: 'enterprise', label: 'Enterprise (200+)' },
]

function Field({ label, value, onChange, placeholder, type = 'text', required = false, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; required?: boolean; autoFocus?: boolean
}) {
  const [f, setF] = useState(false)
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
        {label}{required && <span className="text-blood-glow ml-1">*</span>}
      </label>
      <input type={type} value={value} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)}
        placeholder={placeholder}
        className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3 outline-none transition-all placeholder:text-gray-3"
        style={{ borderColor: f ? '#8b0000' : '#222226' }} />
    </div>
  )
}

function Chips({ label, options, selected, onToggle, required }: {
  label: string; options: { value: string; label: string }[]
  selected: string[]; onToggle: (v: string) => void; required?: boolean
}) {
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2.5">
        {label}{required && <span className="text-blood-glow ml-1">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map(o => {
          const on = selected.includes(o.value)
          return (
            <button key={o.value} type="button" onClick={() => onToggle(o.value)}
              className="font-condensed font-semibold uppercase text-[11px] tracking-[0.1em] px-3.5 py-2 border cursor-pointer transition-all"
              style={{ borderColor: on ? '#8b0000' : '#222226', background: on ? 'rgba(139,0,0,0.12)' : '#141416', color: on ? '#f0ece4' : '#7a7672' }}>
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
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

type Step = 'company' | 'targeting' | 'done'
const STEPS: Step[] = ['company', 'targeting', 'done']

export default function SponsorOnboarding() {
  const { refreshUser, logout } = useAuth()
  const navigate = useNavigate()

  const signOut = async () => { await logout(); navigate('/login', { replace: true }) }
  const [step, setStep] = useState<Step>('company')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    company_name: '', website_url: '', industry: '', company_size: '',
    hq_country: '', hq_region: '', description: '',
    budget_min_usd: '', budget_max_usd: '',
    preferred_weight_classes: [] as string[],
    preferred_promotions:     [] as string[],
    campaign_goals:           [] as string[],
  })
  const set = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))
  const toggle = (k: 'preferred_weight_classes' | 'preferred_promotions' | 'campaign_goals') => (v: string) =>
    setForm(p => ({ ...p, [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v] }))

  const idx = STEPS.indexOf(step)

  const submit = async () => {
    if (!form.company_name.trim()) { setError('Company name is required.'); return }
    setSaving(true); setError('')
    try {
      const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null
      const res = await apiFetch('/api/onboarding/sponsor', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          company_name:            form.company_name.trim(),
          website_url:             form.website_url             || null,
          industry:                form.industry                || null,
          description:             form.description             || null,
          hq_country:              form.hq_country              || null,
          hq_region:               form.hq_region               || null,
          budget_min_usd:          form.budget_min_usd ? Number(form.budget_min_usd) : null,
          budget_max_usd:          form.budget_max_usd ? Number(form.budget_max_usd) : null,
          preferred_weight_classes: form.preferred_weight_classes,
          preferred_promotions:    form.preferred_promotions,
          campaign_goals:          form.campaign_goals,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Setup failed.'); setSaving(false); return }
      await refreshUser()
      setStep('done')
      setTimeout(() => navigate('/dashboard/sponsor', { replace: true }), 2000)
    } catch {
      setError('Could not reach the server. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />
      <div className="flex flex-1 items-center justify-center px-6 py-16 relative z-10">
        <div className="w-full max-w-[520px]">

          <div className="text-center mb-8">
            <Link to="/" className="no-underline font-display text-off-white uppercase tracking-widest" style={{ fontSize: 20 }}>
              Eleventh Round
            </Link>
            <p className="font-condensed text-[11px] tracking-[0.3em] uppercase text-gray-3 mt-2">
              Sponsor Setup
            </p>
            <button onClick={signOut}
              className="font-condensed text-[10px] tracking-[0.2em] uppercase text-gray-3 hover:text-blood-glow transition-colors mt-3 bg-transparent border-0 cursor-pointer">
              Not you? Sign out
            </button>
          </div>

          <Progress current={idx} total={STEPS.length - 1} />

          {step !== 'done' && (
            <div className="bg-charcoal border border-charcoal-3 p-8 relative overflow-hidden"
                 style={{ borderLeft: '2px solid #8b0000' }}>
              <div className="relative z-10">

                {step === 'company' && (
                  <>
                    <div className="sec-label mb-1">Step 1</div>
                    <h2 className="font-display text-off-white uppercase mb-6"
                        style={{ fontSize: 'clamp(28px,3.5vw,40px)', lineHeight: 0.92 }}>
                      Your Company
                    </h2>
                    <div className="space-y-4">
                      <Field label="Company / Brand Name" value={form.company_name}
                        onChange={set('company_name')} placeholder="Acme Athletics" required autoFocus />
                      <Field label="Website" value={form.website_url} onChange={set('website_url')} placeholder="https://acme.com" />
                      <Field label="Industry / Category" value={form.industry} onChange={set('industry')} placeholder="Apparel, Supplements, Tech…" />
                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2.5">
                          Company Size
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {SIZES.map(s => {
                            const on = form.company_size === s.value
                            return (
                              <button key={s.value} type="button"
                                onClick={() => set('company_size')(on ? '' : s.value)}
                                className="font-condensed font-semibold uppercase text-[11px] tracking-[0.1em] px-3.5 py-2 border cursor-pointer transition-all"
                                style={{ borderColor: on ? '#8b0000' : '#222226', background: on ? 'rgba(139,0,0,0.12)' : '#141416', color: on ? '#f0ece4' : '#7a7672' }}>
                                {s.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="HQ Country" value={form.hq_country} onChange={set('hq_country')} placeholder="US" />
                        <Field label="HQ Region"  value={form.hq_region}  onChange={set('hq_region')} placeholder="California" />
                      </div>
                      <div>
                        <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
                          About Your Brand (optional)
                        </label>
                        <textarea value={form.description} onChange={e => set('description')(e.target.value)} rows={3}
                          placeholder="Brief description of your company and why you want to sponsor fighters…"
                          className="w-full bg-charcoal-2 border border-charcoal-3 text-off-white font-body text-[14px] px-4 py-3 outline-none resize-none" />
                      </div>
                    </div>
                  </>
                )}

                {step === 'targeting' && (
                  <>
                    <div className="sec-label mb-1">Step 2</div>
                    <h2 className="font-display text-off-white uppercase mb-6"
                        style={{ fontSize: 'clamp(28px,3.5vw,40px)', lineHeight: 0.92 }}>
                      Sponsorship Targeting
                    </h2>
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Budget Min (USD/yr)" type="number" value={form.budget_min_usd}
                          onChange={set('budget_min_usd')} placeholder="5000" />
                        <Field label="Budget Max (USD/yr)" type="number" value={form.budget_max_usd}
                          onChange={set('budget_max_usd')} placeholder="50000" />
                      </div>
                      <Chips label="Campaign Goals" options={GOALS} selected={form.campaign_goals} onToggle={toggle('campaign_goals')} />
                      <Chips label="Preferred Combat Sports" options={COMBAT_SPORTS.map(p => ({ value: p.toLowerCase(), label: p }))}
                        selected={form.preferred_promotions} onToggle={toggle('preferred_promotions')} />
                      <Chips label="Preferred Weight Classes" options={WEIGHT_CLASSES.map(w => ({ value: w, label: w }))}
                        selected={form.preferred_weight_classes} onToggle={toggle('preferred_weight_classes')} />
                    </div>

                    {/* Vetting notice */}
                    <div className="mt-6 px-4 py-3 border border-charcoal-3 bg-charcoal-2">
                      <p className="font-condensed text-[11px] text-gray-2 leading-relaxed">
                        <span className="font-bold text-off-white">Note:</span> After setup, your profile will be reviewed by our admin team.
                        Once approved, you can contact fighters and publish opportunities.
                        This usually takes 24–48 hours.
                      </p>
                    </div>
                  </>
                )}

                {error && (
                  <div className="mt-5 font-condensed text-[11px] text-blood-glow bg-blood/10 border border-blood/25 px-4 py-2.5">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 mt-7">
                  {step === 'targeting' && (
                    <button onClick={() => { setError(''); setStep('company') }}
                      className="btn-ghost flex-1" disabled={saving}>Back</button>
                  )}
                  <button type="button" disabled={saving}
                    onClick={() => {
                      setError('')
                      if (step === 'company') {
                        if (!form.company_name.trim()) { setError('Company name is required.'); return }
                        setStep('targeting')
                      } else {
                        submit()
                      }
                    }}
                    className="btn-primary flex-1 text-center disabled:opacity-50"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 border border-off-white/40 border-t-off-white rounded-full animate-spin" />
                        Saving…
                      </span>
                    ) : step === 'targeting' ? 'Complete Setup' : 'Continue →'}
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
                  width: 56, height: 56, borderRadius: '50%', background: 'rgba(139,0,0,0.15)',
                  border: '1.5px solid #8b0000', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', margin: '0 auto 24px',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C41E3A"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="sec-label mb-2 justify-center">Profile Created</div>
                <h2 className="font-display text-off-white uppercase mb-4"
                    style={{ fontSize: 'clamp(28px,4vw,44px)', lineHeight: 0.92 }}>
                  Welcome Aboard.
                </h2>
                <p className="font-narrow text-gray-2 mb-4" style={{ fontSize: 13 }}>
                  Your sponsor profile is pending admin review. You will be notified once approved and can then
                  contact fighters and publish opportunities.
                </p>
                <p className="font-narrow text-gray-2" style={{ fontSize: 13 }}>
                  Taking you to your dashboard…
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
