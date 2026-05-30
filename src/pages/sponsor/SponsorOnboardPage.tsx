import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getSponsorStatus, onboardSponsor } from '../../lib/api/sponsors'
import Navbar from '../../components/Navbar'

// ── Reference data ─────────────────────────────────────────────────────────────
const WEIGHT_CLASSES = [
  'Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight',
  'Middleweight', 'Light Heavyweight', 'Heavyweight',
  "Women's Strawweight", "Women's Flyweight", "Women's Bantamweight",
]
const PROMOTIONS   = ['UFC', 'ONE Championship', 'PFL', 'Bellator', 'Regional / Other']
const GOALS        = [
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

type Step = 'company' | 'preferences' | 'done'
const STEPS: Step[] = ['company', 'preferences', 'done']

// ── Small styled inputs (mirror RegisterPage tokens) ───────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text', autoFocus }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; autoFocus?: boolean
}) {
  const [f, setF] = useState(false)
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">{label}</label>
      <input
        type={type} value={value} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)}
        placeholder={placeholder}
        className="w-full bg-charcoal-2 border text-off-white font-body text-[14px] px-4 py-3 outline-none transition-all duration-200 placeholder:text-gray-3"
        style={{ borderColor: f ? '#8b0000' : '#222226' }}
      />
    </div>
  )
}

function Chips({ label, options, selected, onToggle }: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2.5">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(o => {
          const on = selected.includes(o.value)
          return (
            <button key={o.value} type="button" onClick={() => onToggle(o.value)}
              className="font-condensed font-semibold uppercase text-[11px] tracking-[0.1em] px-3.5 py-2 border cursor-pointer transition-all"
              style={{
                borderColor: on ? '#8b0000' : '#222226',
                background:  on ? 'rgba(139,0,0,0.12)' : '#141416',
                color:       on ? '#f0ece4' : '#7a7672',
              }}>
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function SponsorOnboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep]       = useState<Step>('company')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  const [form, setForm] = useState({
    company_name: '', website_url: '', industry: '', company_size: '',
    hq_country: '', hq_region: '', description: '',
    budget_min_usd: '', budget_max_usd: '',
    preferred_weight_classes: [] as string[],
    preferred_promotions: [] as string[],
    campaign_goals: [] as string[],
  })
  const set = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))
  const toggle = (k: 'preferred_weight_classes' | 'preferred_promotions' | 'campaign_goals') => (v: string) =>
    setForm(p => ({ ...p, [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v] }))

  // Guard: must be sponsor; skip if already onboarded.
  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return }
    if (user.role !== 'sponsor' && user.role !== 'admin') { navigate('/login', { replace: true }); return }
    getSponsorStatus()
      .then(s => { if (s.onboarded) navigate('/dashboard/sponsor', { replace: true }); else setChecking(false) })
      .catch(() => setChecking(false))
  }, [user, navigate])

  const idx = STEPS.indexOf(step)

  const next = () => {
    setError('')
    if (step === 'company') {
      if (!form.company_name.trim()) return setError('Company name is required.')
      setStep('preferences'); return
    }
    if (step === 'preferences') { submit(); return }
  }

  const submit = async () => {
    setLoading(true); setError('')
    try {
      await onboardSponsor({
        company_name: form.company_name.trim(),
        website_url:  form.website_url || undefined,
        industry:     form.industry || undefined,
        company_size: (form.company_size || undefined) as any,
        hq_country:   form.hq_country || undefined,
        hq_region:    form.hq_region || undefined,
        description:  form.description || undefined,
        budget_min_usd: form.budget_min_usd ? Number(form.budget_min_usd) : undefined,
        budget_max_usd: form.budget_max_usd ? Number(form.budget_max_usd) : undefined,
        preferred_weight_classes: form.preferred_weight_classes,
        preferred_promotions:     form.preferred_promotions,
        campaign_goals:           form.campaign_goals,
      })
      setStep('done')
      setTimeout(() => navigate('/dashboard/sponsor', { replace: true }), 1600)
    } catch (e: any) {
      setError(e.message ?? 'Could not save. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />
      <div className="flex flex-1 items-center justify-center px-6 py-24 relative z-10">
        <div className="w-full max-w-[520px]">

          <div className="text-center mb-8">
            <Link to="/" className="no-underline font-display text-off-white uppercase tracking-widest" style={{ fontSize: 22 }}>
              Eleventh Round
            </Link>
            <p className="font-condensed text-[11px] tracking-[0.3em] uppercase text-gray-3 mt-2">
              Sponsor Setup
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 justify-center mb-8">
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === idx ? 20 : 6, height: 4, borderRadius: 2,
                background: i < idx ? '#8b0000' : i === idx ? '#C41E3A' : '#222226',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>

          <div className="bg-charcoal border border-charcoal-3 p-8 relative overflow-hidden" style={{ borderLeft: '2px solid #8b0000' }}>

            {step === 'company' && (
              <>
                <div className="sec-label mb-1">Step 1</div>
                <h2 className="font-display text-off-white uppercase mb-6" style={{ fontSize: 'clamp(28px,3.5vw,40px)', lineHeight: 0.92 }}>
                  Your Company
                </h2>
                <div className="space-y-4">
                  <Field label="Company Name *" value={form.company_name} onChange={set('company_name')} placeholder="Acme Athletics" autoFocus />
                  <Field label="Website" value={form.website_url} onChange={set('website_url')} placeholder="https://acme.com" />
                  <Field label="Industry" value={form.industry} onChange={set('industry')} placeholder="Apparel, Supplements, Tech…" />
                  <div>
                    <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2.5">Company Size</label>
                    <div className="flex flex-wrap gap-2">
                      {SIZES.map(s => {
                        const on = form.company_size === s.value
                        return (
                          <button key={s.value} type="button" onClick={() => set('company_size')(on ? '' : s.value)}
                            className="font-condensed font-semibold uppercase text-[11px] tracking-[0.1em] px-3.5 py-2 border cursor-pointer transition-all"
                            style={{ borderColor: on ? '#8b0000' : '#222226', background: on ? 'rgba(139,0,0,0.12)' : '#141416', color: on ? '#f0ece4' : '#7a7672' }}>
                            {s.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="HQ Country" value={form.hq_country} onChange={set('hq_country')} placeholder="US" />
                    <Field label="HQ Region" value={form.hq_region} onChange={set('hq_region')} placeholder="California" />
                  </div>
                </div>
              </>
            )}

            {step === 'preferences' && (
              <>
                <div className="sec-label mb-1">Step 2</div>
                <h2 className="font-display text-off-white uppercase mb-6" style={{ fontSize: 'clamp(28px,3.5vw,40px)', lineHeight: 0.92 }}>
                  Sponsorship Targeting
                </h2>
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Budget Min (USD/yr)" type="number" value={form.budget_min_usd} onChange={set('budget_min_usd')} placeholder="5000" />
                    <Field label="Budget Max (USD/yr)" type="number" value={form.budget_max_usd} onChange={set('budget_max_usd')} placeholder="50000" />
                  </div>
                  <Chips label="Campaign Goals" options={GOALS} selected={form.campaign_goals} onToggle={toggle('campaign_goals')} />
                  <Chips label="Preferred Promotions" options={PROMOTIONS.map(p => ({ value: p, label: p }))} selected={form.preferred_promotions} onToggle={toggle('preferred_promotions')} />
                  <Chips label="Preferred Weight Classes" options={WEIGHT_CLASSES.map(w => ({ value: w, label: w }))} selected={form.preferred_weight_classes} onToggle={toggle('preferred_weight_classes')} />
                </div>
              </>
            )}

            {step === 'done' && (
              <div className="text-center py-6">
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(139,0,0,0.15)', border: '1.5px solid #8b0000', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C41E3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h2 className="font-display text-off-white uppercase mb-3" style={{ fontSize: 'clamp(26px,3.5vw,38px)', lineHeight: 0.92 }}>You're Set</h2>
                <p className="font-narrow text-gray-2" style={{ fontSize: 13 }}>Taking you to your sponsor console…</p>
              </div>
            )}

            {error && <p className="font-condensed text-blood-glow mt-5" style={{ fontSize: 12 }}>{error}</p>}

            {step !== 'done' && (
              <div className="flex gap-3 mt-7">
                {step === 'preferences' && (
                  <button onClick={() => { setError(''); setStep('company') }}
                    className="btn-ghost flex-1" disabled={loading}>Back</button>
                )}
                <button onClick={next} className="btn-primary flex-1" disabled={loading}>
                  {loading ? 'Saving…' : step === 'preferences' ? 'Finish' : 'Continue'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
